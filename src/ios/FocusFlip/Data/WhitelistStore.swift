import Foundation
import UIKit

/// iOS cannot list every installed app. This catalog matches the Android
/// whitelist UX using public URL schemes the user can tick and open.
enum AppCatalog {
    static let all: [CatalogApp] = [
        .init(label: "Phone", scheme: "tel"),
        .init(label: "Messages", scheme: "sms"),
        .init(label: "Mail", scheme: "mailto"),
        .init(label: "Safari", scheme: "http"),
        .init(label: "Clock", scheme: "clock-worldclock"),
        .init(label: "Calculator", scheme: "calc"),
        .init(label: "Calendar", scheme: "calshow"),
        .init(label: "Notes", scheme: "mobilenotes"),
        .init(label: "Reminders", scheme: "x-apple-reminderkit"),
        .init(label: "Maps", scheme: "maps"),
        .init(label: "Music", scheme: "music"),
        .init(label: "Podcasts", scheme: "podcasts"),
        .init(label: "Books", scheme: "ibooks"),
        .init(label: "App Store", scheme: "itms-apps"),
        .init(label: "Settings", scheme: "App-Prefs"),
        .init(label: "Camera", scheme: "camera"),
        .init(label: "Photos", scheme: "photos-redirect"),
        .init(label: "Health", scheme: "x-apple-health"),
        .init(label: "Wallet", scheme: "shoebox"),
        .init(label: "Weather", scheme: "weather"),
        .init(label: "News", scheme: "applenews"),
        .init(label: "Stocks", scheme: "stocks"),
        .init(label: "Voice Memos", scheme: "voicememos"),
        .init(label: "Files", scheme: "shareddocuments"),
        .init(label: "Translate", scheme: "translate"),
        .init(label: "Measure", scheme: "measure"),
        .init(label: "Find My", scheme: "findmy"),
        .init(label: "Shortcuts", scheme: "shortcuts"),
        .init(label: "YouTube", scheme: "youtube"),
        .init(label: "Spotify", scheme: "spotify"),
        .init(label: "Instagram", scheme: "instagram"),
        .init(label: "X", scheme: "twitter"),
        .init(label: "WhatsApp", scheme: "whatsapp"),
        .init(label: "Telegram", scheme: "tg"),
        .init(label: "Signal", scheme: "sgnl"),
        .init(label: "Discord", scheme: "discord"),
        .init(label: "Slack", scheme: "slack"),
        .init(label: "Zoom", scheme: "zoomus"),
        .init(label: "Google Maps", scheme: "comgooglemaps"),
        .init(label: "Gmail", scheme: "googlegmail"),
        .init(label: "Chrome", scheme: "googlechrome"),
        .init(label: "Outlook", scheme: "ms-outlook"),
        .init(label: "Notion", scheme: "notion"),
        .init(label: "Anki", scheme: "anki"),
    ].sorted { $0.label.localizedCaseInsensitiveCompare($1.label) == .orderedAscending }

    static func launch(_ app: CatalogApp) {
        let urlString: String
        switch app.scheme {
        case "http": urlString = "https://www.apple.com"
        case "tel": urlString = "tel://"
        case "sms": urlString = "sms:"
        case "mailto": urlString = "mailto:"
        default: urlString = "\(app.scheme)://"
        }
        guard let url = URL(string: urlString) else { return }
        UIApplication.shared.open(url)
    }
}

final class WhitelistStore: ObservableObject {
    @Published private(set) var schemes: Set<String>
    private let key = "focusflip_whitelist"

    init() {
        schemes = Set(UserDefaults.standard.stringArray(forKey: key) ?? [])
    }

    func contains(_ scheme: String) -> Bool { schemes.contains(scheme) }

    func set(_ scheme: String, allowed: Bool) {
        if allowed { schemes.insert(scheme) } else { schemes.remove(scheme) }
        UserDefaults.standard.set(Array(schemes), forKey: key)
    }

    var selectedApps: [CatalogApp] {
        AppCatalog.all.filter { schemes.contains($0.scheme) }
    }
}
