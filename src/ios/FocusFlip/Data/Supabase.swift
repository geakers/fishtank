import Foundation

enum SupabaseError: LocalizedError {
    /// HTTP status, readable message and PostgREST's error code (e.g. PGRST202) when it sent one.
    case message(Int, String, code: String? = nil)
    var errorDescription: String? {
        switch self {
        case .message(_, let text, _): return text
        }
    }
    var code: String? {
        switch self {
        case .message(_, _, let code): return code
        }
    }
}

final class SupabaseClient {
    let baseURL: String
    let apiKey: String

    init(baseURL: String = Config.supabaseURL, apiKey: String = Config.supabaseKey) {
        self.baseURL = baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        self.apiKey = apiKey
    }

    func request(
        method: String,
        path: String,
        bearer: String? = nil,
        body: [String: Any]? = nil,
        prefer: String? = nil
    ) async throws -> Data {
        guard let url = URL(string: baseURL + path) else {
            throw SupabaseError.message(0, "Bad URL.")
        }
        var req = URLRequest(url: url, timeoutInterval: 15)
        req.httpMethod = method
        req.setValue(apiKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(bearer ?? apiKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let prefer { req.setValue(prefer, forHTTPHeaderField: "Prefer") }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if !(200...299).contains(status) {
            let json = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
            let message = (json["msg"] as? String)
                ?? (json["error_description"] as? String)
                ?? (json["message"] as? String)
                ?? "Request failed (\(status))."
            throw SupabaseError.message(status, friendly(message), code: json["code"] as? String)
        }
        return data
    }

    private func friendly(_ message: String) -> String {
        switch message {
        case "Invalid login credentials": return "Incorrect email or password."
        case "User already registered": return "An account with this email already exists."
        default: return message
        }
    }
}

@MainActor
final class AuthRepository {
    private let http: SupabaseClient
    let store: SessionStore
    /// The refresh in flight. Supabase refresh tokens work once, so two refreshes at the
    /// same time would make the second fail and log the user out.
    private var refreshing: Task<Bool, Never>?

    init(http: SupabaseClient, store: SessionStore) {
        self.http = http
        self.store = store
    }

    func login(email: String, password: String) async -> AuthResult {
        await call {
            let data = try await http.request(
                method: "POST",
                path: "/auth/v1/token?grant_type=password",
                body: ["email": email.trimmingCharacters(in: .whitespacesAndNewlines), "password": password]
            )
            return try saveSession(data)
        }
    }

    func register(username: String, email: String, password: String) async -> AuthResult {
        await call {
            let data = try await http.request(
                method: "POST",
                path: "/auth/v1/signup",
                body: [
                    "email": email.trimmingCharacters(in: .whitespacesAndNewlines),
                    "password": password,
                    "data": ["username": username.trimmingCharacters(in: .whitespacesAndNewlines)],
                ]
            )
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
            if json["access_token"] == nil {
                return .failure("Account created. Check your email to confirm it, then log in.")
            }
            return try saveSession(data)
        }
    }

    /// The logged-in user's access token, renewed first if it is about to expire.
    /// nil when nobody is logged in or the session has ended.
    func accessToken() async -> String? {
        guard await refreshSession() else { return nil }
        return store.session?.accessToken
    }

    /// Renews the session when it is within 5 minutes of expiring. Returns false only
    /// when nobody is logged in or Supabase ended the session; being offline keeps it.
    func refreshSession() async -> Bool {
        if let refreshing { return await refreshing.value }
        let task = Task { await renew() }
        refreshing = task
        defer { refreshing = nil }
        return await task.value
    }

    private func renew() async -> Bool {
        guard let current = store.session else { return false }
        guard let refresh = current.refreshToken else {
            store.clear()
            return false
        }
        if Date().timeIntervalSince1970 < current.expiresAt - 5 * 60 { return true }
        do {
            let data = try await http.request(
                method: "POST",
                path: "/auth/v1/token?grant_type=refresh_token",
                body: ["refresh_token": refresh]
            )
            _ = try saveSession(data)
            return true
        } catch let SupabaseError.message(status, _, _) where (400...499).contains(status) {
            store.clear()
            return false
        } catch {
            return true
        }
    }

    func logout() async {
        let token = store.session?.accessToken
        store.clear()
        if let token {
            // scope=local, as on the desktop: sessions on the user's other devices stay logged in.
            _ = try? await http.request(method: "POST", path: "/auth/v1/logout?scope=local", bearer: token, body: [:])
        }
    }

    private func call(_ block: () async throws -> AuthResult) async -> AuthResult {
        do { return try await block() }
        catch let err as SupabaseError { return .failure(err.localizedDescription) }
        catch { return .failure("Can't reach the server. Check your internet connection.") }
    }

    private func saveSession(_ data: Data) throws -> AuthResult {
        guard
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let token = json["access_token"] as? String,
            let user = json["user"] as? [String: Any],
            let id = user["id"] as? String
        else { throw SupabaseError.message(0, "Bad login response.") }
        let email = user["email"] as? String ?? ""
        let username = (user["user_metadata"] as? [String: Any])?["username"] as? String
        let expires = json["expires_in"] as? Double ?? 3600
        let session = AuthSession(
            user: User(id: id, email: email, displayName: (username?.isEmpty == false ? username! : email.split(separator: "@").first.map(String.init) ?? email)),
            accessToken: token,
            refreshToken: json["refresh_token"] as? String,
            expiresAt: Date().timeIntervalSince1970 + expires
        )
        store.save(session)
        return .success(session)
    }
}


/// Keeps focus blocks on the device until they are added to the account, and mirrors the
/// account's profile row (username, points, minutes studied) for the home screen.
@MainActor
final class SyncRepository: ObservableObject {
    @Published private(set) var status = SyncStatus()

    private let http: SupabaseClient
    private let auth: AuthRepository
    private let defaults = UserDefaults.standard
    private let recordsKey = "focusflip_records"
    private let lastSyncKey = "focusflip_last_sync"
    private let accountMsKey = "focusflip_account_ms"
    private let accountPointsKey = "focusflip_account_points"
    private let usernameKey = "focusflip_username"
    private let pointsValidKey = "focusflip_points_valid"
    /// The sync running now. Each sync waits for the one before it, so two syncs never
    /// add the same records to the account twice.
    private var running: Task<Void, Never>?

    init(http: SupabaseClient, auth: AuthRepository) {
        self.http = http
        self.auth = auth
        status = buildStatus()
    }

    func record(_ record: FocusRecord) {
        var all = load()
        all.append(record)
        save(all)
        status = buildStatus()
        Task { await syncNow() }
    }

    func syncNow() async {
        let previous = running
        let task = Task {
            await previous?.value
            await performSync()
        }
        running = task
        await task.value
    }

    /// Forgets the cached account so the next user doesn't see it. Unsynced records stay.
    func clearAccount() {
        for key in [accountMsKey, accountPointsKey, usernameKey, pointsValidKey, lastSyncKey] {
            defaults.removeObject(forKey: key)
        }
        status = buildStatus()
    }

    private func performSync() async {
        status = buildStatus(isSyncing: true)
        do {
            guard let token = await auth.accessToken(), let uid = auth.store.session?.user.id else {
                throw SupabaseError.message(401, "Not logged in.")
            }
            var profile = try await fetchProfile(uid: uid, token: token)
            let pending = load().filter { !$0.synced }
            // Every session adds the time it ran; only finished commitments add points.
            let earned = pending.map(Config.earnings(for:))
            let addedMinutes = earned.reduce(0) { $0 + $1.minutes }
            let pointsDelta = earned.reduce(0) { $0 + $1.points }

            if addedMinutes > 0 || pointsDelta != 0 {
                // One PATCH, so minutes and points are saved together or not at all.
                // Rounded so repeated additions don't pick up floating point noise.
                profile = try await writeProfile(uid: uid, token: token, minutes: profile.minutes + addedMinutes,
                                                 points: ((profile.points + pointsDelta) * 10_000).rounded() / 10_000)
            }
            if !pending.isEmpty {
                let ids = Set(pending.map(\.id))
                save(load().map { ids.contains($0.id) ? $0.markedSynced() : $0 })
            }
            defaults.set(profile.minutes * 60_000, forKey: accountMsKey)
            defaults.set(profile.points, forKey: accountPointsKey)
            if let username = profile.username { defaults.set(username, forKey: usernameKey) }
            defaults.set(Date().timeIntervalSince1970, forKey: lastSyncKey)
            status = buildStatus()
        } catch {
            status = buildStatus(error: error.localizedDescription)
        }
    }

    private func fetchProfile(uid: String, token: String) async throws -> Profile {
        let data = try await http.request(
            method: "GET",
            path: "/rest/v1/profiles?uid=eq.\(encoded(uid))&select=username,minutes_studied,points&limit=1",
            bearer: token
        )
        let rows = (try JSONSerialization.jsonObject(with: data) as? [[String: Any]]) ?? []
        guard let row = rows.first else { throw SupabaseError.message(404, "No profile found.") }
        return profile(row)
    }

    private func writeProfile(uid: String, token: String, minutes: Int, points: Double) async throws -> Profile {
        let data = try await http.request(
            method: "PATCH",
            path: "/rest/v1/profiles?uid=eq.\(encoded(uid))&select=username,minutes_studied,points",
            bearer: token,
            body: ["minutes_studied": minutes, "points": points],
            prefer: "return=representation"
        )
        let rows = (try JSONSerialization.jsonObject(with: data) as? [[String: Any]]) ?? []
        // No row back means row level security refused the change.
        guard let row = rows.first else { throw SupabaseError.message(403, "No profile was updated.") }
        return profile(row)
    }

    private struct Profile {
        var username: String?
        var minutes: Int
        var points: Double
    }

    private func profile(_ row: [String: Any]) -> Profile {
        Profile(
            username: row["username"] as? String,
            minutes: (row["minutes_studied"] as? NSNumber)?.intValue ?? 0,
            points: (row["points"] as? NSNumber)?.doubleValue ?? 0
        )
    }

    private func encoded(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? value
    }

    private func load() -> [FocusRecord] {
        guard let data = defaults.data(forKey: recordsKey) else { return [] }
        return (try? JSONDecoder().decode([FocusRecord].self, from: data)) ?? []
    }

    private func save(_ records: [FocusRecord]) {
        if let data = try? JSONEncoder().encode(Array(records.suffix(500))) {
            defaults.set(data, forKey: recordsKey)
        }
    }

    private func buildStatus(isSyncing: Bool = false, error: String? = nil) -> SyncStatus {
        let records = load()
        let start = Calendar.current.startOfDay(for: Date()).timeIntervalSince1970
        let today = records.filter { $0.startedAt >= start }
        let last = defaults.object(forKey: lastSyncKey) as? TimeInterval
        return SyncStatus(
            lastSyncAt: last.map { Date(timeIntervalSince1970: $0) },
            pendingCount: records.filter { !$0.synced }.count,
            todayFocusMinutes: today.reduce(0) { $0 + Int(max(0, $1.endedAt - $1.startedAt) / 60) },
            todaySessions: today.filter(\.completed).count,
            accountFocusMs: UInt64(max(0, defaults.integer(forKey: accountMsKey))),
            accountPoints: defaults.double(forKey: accountPointsKey),
            username: defaults.string(forKey: usernameKey),
            pointsValid: defaults.object(forKey: pointsValidKey) as? Bool ?? true,
            isSyncing: isSyncing,
            lastError: error
        )
    }
}
