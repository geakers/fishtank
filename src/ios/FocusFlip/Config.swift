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

    /// What a session of this many seconds adds to the account, by the desktop's
    /// endSession rules. In test mode each second is a point and a part minute counts as a
    /// whole one, so the points never outrun what the points check allows.
    static func earnings(seconds: Int) -> (minutes: Int, points: Double) {
        if testPointPerSecond {
            return (Int((Double(seconds) / 60).rounded(.up)), Double(seconds))
        }
        let minutes = seconds / 60
        return (minutes, Double(minutes) * pointsPerMinute)
    }
    // How often the study groups screen checks for new invites and groups.
    static let groupsRefreshSeconds: TimeInterval = 30
}
