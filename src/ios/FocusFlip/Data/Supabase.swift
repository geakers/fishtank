import Foundation

enum SupabaseError: LocalizedError {
    case message(Int, String)
    var errorDescription: String? {
        switch self {
        case .message(_, let text): return text
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
            throw SupabaseError.message(status, friendly(message))
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

final class AuthRepository {
    private let http: SupabaseClient
    let store: SessionStore

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

    func refreshSession() async -> Bool {
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
        } catch let SupabaseError.message(status, _) where (400...499).contains(status) {
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
            _ = try? await http.request(method: "POST", path: "/auth/v1/logout", bearer: token, body: [:])
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

final class SyncRepository: ObservableObject {
    @Published private(set) var status = SyncStatus()

    private let http: SupabaseClient
    private let sessions: SessionStore
    private let defaults = UserDefaults.standard
    private let recordsKey = "focusflip_records"
    private let lastSyncKey = "focusflip_last_sync"
    private let accountMsKey = "focusflip_account_ms"
    private let accountPointsKey = "focusflip_account_points"
    private let unlockCost = 100.0

    init(http: SupabaseClient, sessions: SessionStore) {
        self.http = http
        self.sessions = sessions
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
        await MainActor.run { status = buildStatus(isSyncing: true) }
        do {
            guard let token = sessions.session?.accessToken, let uid = sessions.session?.user.id else {
                throw SupabaseError.message(401, "Not logged in.")
            }
            let profile = try await fetchProfile(uid: uid, token: token)
            let pending = load().filter { !$0.synced }
            let added = pending.reduce(0) { $0 + studiedMinutes($1) }
            let nextMinutes = added > 0
                ? try await writeMinutesStudied(uid: uid, token: token, value: profile.minutes + added)
                : profile.minutes
            defaults.set(nextMinutes * 60_000, forKey: accountMsKey)
            defaults.set(profile.points, forKey: accountPointsKey)
            if !pending.isEmpty {
                let ids = Set(pending.map(\.id))
                save(load().map { ids.contains($0.id) ? FocusRecord(id: $0.id, startedAt: $0.startedAt, endedAt: $0.endedAt, plannedMinutes: $0.plannedMinutes, completed: $0.completed, synced: true) : $0 })
            }
            defaults.set(Date().timeIntervalSince1970, forKey: lastSyncKey)
            await MainActor.run { status = buildStatus() }
        } catch {
            await MainActor.run { status = buildStatus(error: error.localizedDescription) }
        }
    }

    func spendUnlockPoints() async {
        let cached = defaults.double(forKey: accountPointsKey)
        let current: Double
        if let token = sessions.session?.accessToken, let uid = sessions.session?.user.id {
            current = (try? await fetchProfile(uid: uid, token: token).points) ?? cached
            let next = current - unlockCost
            _ = try? await writePoints(uid: uid, token: token, value: next)
            defaults.set(next, forKey: accountPointsKey)
        } else {
            defaults.set(cached - unlockCost, forKey: accountPointsKey)
        }
        await MainActor.run { status = buildStatus() }
    }

    private func fetchProfile(uid: String, token: String) async throws -> (minutes: Int, points: Double) {
        let q = uid.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? uid
        let data = try await http.request(method: "GET", path: "/rest/v1/profiles?uid=eq.\(q)&select=minutes_studied,points&limit=1", bearer: token)
        let rows = (try JSONSerialization.jsonObject(with: data) as? [[String: Any]]) ?? []
        let cachedMinutes = defaults.integer(forKey: accountMsKey) / 60_000
        let cachedPoints = defaults.double(forKey: accountPointsKey)
        guard let first = rows.first else { return (cachedMinutes, cachedPoints) }
        return (intField(first, "minutes_studied", cachedMinutes), doubleField(first, "points", cachedPoints))
    }

    private func writeMinutesStudied(uid: String, token: String, value: Int) async throws -> Int {
        let q = uid.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? uid
        let data = try await http.request(
            method: "PATCH",
            path: "/rest/v1/profiles?uid=eq.\(q)",
            bearer: token,
            body: ["minutes_studied": value],
            prefer: "return=representation"
        )
        let rows = (try JSONSerialization.jsonObject(with: data) as? [[String: Any]]) ?? []
        if let first = rows.first { return intField(first, "minutes_studied", value) }
        return value
    }

    private func writePoints(uid: String, token: String, value: Double) async throws -> Double {
        let q = uid.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? uid
        let data = try await http.request(
            method: "PATCH",
            path: "/rest/v1/profiles?uid=eq.\(q)",
            bearer: token,
            body: ["points": value],
            prefer: "return=representation"
        )
        let rows = (try JSONSerialization.jsonObject(with: data) as? [[String: Any]]) ?? []
        if let first = rows.first { return doubleField(first, "points", value) }
        return value
    }

    private func intField(_ row: [String: Any], _ key: String, _ fallback: Int) -> Int {
        (row[key] as? NSNumber)?.intValue ?? fallback
    }

    private func doubleField(_ row: [String: Any], _ key: String, _ fallback: Double) -> Double {
        (row[key] as? NSNumber)?.doubleValue ?? fallback
    }

    /// One finished 45-minute focus block = +45. Breaks and aborted sessions add nothing.
    private func studiedMinutes(_ record: FocusRecord) -> Int {
        record.completed ? max(0, record.plannedMinutes) : 0
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
            accountFocusMs: UInt64(defaults.integer(forKey: accountMsKey)),
            accountPoints: defaults.double(forKey: accountPointsKey),
            isSyncing: isSyncing,
            lastError: error
        )
    }
}
