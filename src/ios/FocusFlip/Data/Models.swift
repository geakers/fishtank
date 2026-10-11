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
    case idle, focus, breakTime
}

struct SessionState: Equatable {
    var phase: Phase = .idle
    var phaseStartedAt: TimeInterval = 0
    var phaseEndsAt: TimeInterval = 0
    var continueAfterBreak: Bool = true
    var cycle: Int = 0

    var phaseDurationMs: UInt64 { UInt64(max(0, (phaseEndsAt - phaseStartedAt) * 1000)) }
    func remainingMs(now: Date = Date()) -> UInt64 {
        UInt64(max(0, phaseEndsAt - now.timeIntervalSince1970) * 1000)
    }
}

struct FocusRecord: Codable, Identifiable, Equatable {
    var id: String
    var startedAt: TimeInterval
    var endedAt: TimeInterval
    var plannedMinutes: Int
    var completed: Bool
    var synced: Bool = false
}

struct SyncStatus: Equatable {
    var lastSyncAt: Date?
    var pendingCount: Int = 0
    var todayFocusMinutes: Int = 0
    var todaySessions: Int = 0
    var accountFocusMs: UInt64 = 0
    var accountPoints: Double = 0
    var isSyncing: Bool = false
    var lastError: String?
}

struct CatalogApp: Identifiable, Hashable {
    var id: String { scheme }
    var label: String
    var scheme: String
}
