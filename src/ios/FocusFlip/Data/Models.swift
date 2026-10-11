import Foundation

struct User: Codable, Equatable {
    var id: String
    var email: String
    var displayName: String
}

struct AuthSession: Codable, Equatable {
    var user: User
    var accessToken: String
    var refreshToken: String?
    var expiresAt: TimeInterval
}

enum AuthResult {
    case success(AuthSession)
    case failure(String)
}

enum Phase: String, Codable {
    case idle, focus
}

struct SessionState: Equatable {
    var phase: Phase = .idle
    var startedAt: TimeInterval = 0

    func elapsedSeconds(now: Date = Date()) -> Int {
        phase == .idle ? 0 : Int(max(0, now.timeIntervalSince1970 - startedAt))
    }
}

struct FocusRecord: Codable, Identifiable, Equatable {
    var id: String
    var startedAt: TimeInterval
    var endedAt: TimeInterval
    var plannedMinutes: Int
    var completed: Bool
    var synced: Bool = false

    func markedSynced() -> FocusRecord {
        var copy = self
        copy.synced = true
        return copy
    }
}

struct SyncStatus: Equatable {
    var lastSyncAt: Date?
    var pendingCount: Int = 0
    var todayFocusMinutes: Int = 0
    var todaySessions: Int = 0
    var accountFocusMs: UInt64 = 0
    var accountPoints: Double = 0
    /// The username on the account's profile, once a sync has read it.
    var username: String?
    /// false when the points are more than the minutes studied can account for.
    var pointsValid: Bool = true
    var isSyncing: Bool = false
    var lastError: String?
}

struct CatalogApp: Identifiable, Hashable {
    var id: String { scheme }
    var label: String
    var scheme: String
}

/// A group study session (a row of study_groups). The code says group because session
/// already means the login session and the focus timer, as on the desktop.
struct StudyGroup: Decodable, Identifiable, Equatable {
    var id: Int
    var name: String
    var leaderId: String

    enum CodingKeys: String, CodingKey {
        case id, name
        case leaderId = "leader_id"
    }
}

/// Someone in a group, from group_roster. role is "leader" or "member".
struct GroupMember: Decodable, Equatable {
    var username: String
    var role: String
}

/// An invite the logged-in user hasn't answered yet, from my_invites.
struct GroupInvite: Decodable, Identifiable, Equatable {
    var groupId: Int
    var groupName: String
    /// The leader's username.
    var leader: String

    var id: Int { groupId }

    enum CodingKeys: String, CodingKey {
        case groupId = "group_id"
        case groupName = "group_name"
        case leader
    }
}
