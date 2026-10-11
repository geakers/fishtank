import Foundation

enum Config {
    static let supabaseURL = "https://aakaelrvybduqijgermo.supabase.co"
    static let supabaseKey = "sb_publishable_A6CBnknUmf150g2eQ9ddew_oYSVlsEt"

    // Points rules, kept the same as src/desktop/profiles.js so a minute
    // studied on the phone is worth what it is on the desktop.
    // TESTING ONLY: while true, focus time earns one point per second. Set to
    // false together with TEST_POINT_PER_SECOND for 1/60 point per minute.
    static let testPointPerSecond = true
    static let pointsPerMinute: Double = testPointPerSecond ? 60 : 1.0 / 60

    /// What a focus time of this many seconds is worth, by the desktop's endSession rules.
    /// In test mode each second is a point and a part minute counts as a whole one, so the
    /// points never outrun what the points check allows.
    static func earnings(seconds: Int) -> (minutes: Int, points: Double) {
        if testPointPerSecond {
            return (Int((Double(seconds) / 60).rounded(.up)), Double(seconds))
        }
        let minutes = seconds / 60
        return (minutes, Double(minutes) * pointsPerMinute)
    }

    /// What a finished session adds to the account, like sessionEarnings in
    /// src/desktop/profiles.js: every session adds the minutes it ran, but only one that
    /// lasted its full commitment earns points, and then for exactly the time committed to.
    static func earnings(for record: FocusRecord) -> (minutes: Int, points: Double) {
        let ran = Int(max(0, record.endedAt - record.startedAt))
        guard record.completed else { return (earnings(seconds: ran).minutes, 0) }
        // Sessions from before commitments (plannedMinutes 0) earn for the time they ran.
        return earnings(seconds: record.plannedMinutes > 0 ? record.plannedMinutes * 60 : ran)
    }

    // How long a user can commit to focusing for, in minutes. Kept the same as the desktop.
    static let minCommitMinutes = 1
    static let maxCommitMinutes = 240
    static let commitPresets = [15, 25, 45, 60, 90]
    static let defaultCommitMinutes = 25
    // How often the study groups screen checks for new invites and groups.
    static let groupsRefreshSeconds: TimeInterval = 30
}
