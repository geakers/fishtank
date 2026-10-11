import Foundation

/// Group study sessions, the same calls as src/desktop/groups.js. Row level security
/// and the Postgres functions from src/database/study-groups.sql and
/// study-group-invites.sql decide what the logged-in user may see and change.
@MainActor
final class GroupsRepository {
    private let http: SupabaseClient
    private let auth: AuthRepository
    private let decoder = JSONDecoder()

    init(http: SupabaseClient, auth: AuthRepository) {
        self.http = http
        self.auth = auth
    }

    /// Creates a group led by the logged-in user.
    func createGroup(name: String) async throws -> StudyGroup {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw SupabaseError.message(0, "A study group name is required.") }
        let rows: [StudyGroup] = try await send(
            "POST", "/rest/v1/study_groups?select=id,name,leader_id",
            body: ["name": trimmed], prefer: "return=representation"
        )
        guard let created = rows.first else { throw SupabaseError.message(0, "The group wasn't created.") }
        return created
    }

    /// The groups the logged-in user leads or is a member of, sorted by name.
    func listGroups() async throws -> [StudyGroup] {
        try await send("GET", "/rest/v1/study_groups?select=id,name,leader_id&order=name")
    }

    /// Everyone in the group, leader first.
    func roster(groupId: Int) async throws -> [GroupMember] {
        try await rpc("group_roster", ["gid": groupId])
    }

    /// Up to 10 usernames containing the search text.
    func searchUsernames(_ query: String) async throws -> [String] {
        struct Row: Decodable { var username: String }
        let rows: [Row] = try await rpc("search_usernames", ["query": query])
        return rows.map(\.username)
    }

    /// Invites the user with this username. They join once they accept. Leader only.
    func invite(groupId: Int, username: String) async throws {
        try await inviteRpc("invite_member", ["gid": groupId, "member_username": username])
    }

    /// The invites waiting for the logged-in user, oldest first.
    func myInvites() async throws -> [GroupInvite] {
        try await inviteRpc("my_invites", [:])
    }

    func acceptInvite(groupId: Int) async throws {
        try await inviteRpc("accept_invite", ["gid": groupId])
    }

    func declineInvite(groupId: Int) async throws {
        try await inviteRpc("decline_invite", ["gid": groupId])
    }

    /// Usernames invited to the group who haven't answered. Empty unless the user leads it.
    func pendingInvites(groupId: Int) async throws -> [String] {
        struct Row: Decodable { var username: String }
        let rows: [Row] = try await inviteRpc("group_invites", ["gid": groupId])
        return rows.map(\.username)
    }

    // MARK: - Requests

    private func rpc<T: Decodable>(_ name: String, _ args: [String: Any]) async throws -> T {
        try await send("POST", "/rest/v1/rpc/\(name)", body: args)
    }

    private func rpc(_ name: String, _ args: [String: Any]) async throws {
        _ = try await raw("POST", "/rest/v1/rpc/\(name)", body: args)
    }

    /// Supabase answers PGRST202 for a function it doesn't have, which means the invites
    /// SQL hasn't been run yet.
    private func inviteRpc<T: Decodable>(_ name: String, _ args: [String: Any]) async throws -> T {
        do { return try await rpc(name, args) } catch { throw invitesMissing(error) }
    }

    private func inviteRpc(_ name: String, _ args: [String: Any]) async throws {
        do { try await rpc(name, args) } catch { throw invitesMissing(error) }
    }

    private func invitesMissing(_ error: Error) -> Error {
        (error as? SupabaseError)?.code == "PGRST202"
            ? SupabaseError.message(404, "Invites aren't set up in the database yet.")
            : error
    }

    private func send<T: Decodable>(_ method: String, _ path: String, body: [String: Any]? = nil, prefer: String? = nil) async throws -> T {
        let data = try await raw(method, path, body: body, prefer: prefer)
        return try decoder.decode(T.self, from: data)
    }

    private func raw(_ method: String, _ path: String, body: [String: Any]? = nil, prefer: String? = nil) async throws -> Data {
        guard let token = await auth.accessToken() else { throw SupabaseError.message(401, "Log in first.") }
        return try await http.request(method: method, path: path, bearer: token, body: body, prefer: prefer)
    }
}
