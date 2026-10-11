import SwiftUI

enum Palette {
    static let skyTop = Color(hex: 0xBFEBFF)
    static let skyMid = Color(hex: 0x63C3F0)
    static let grassTop = Color(hex: 0x9EE37D)
    static let grassBottom = Color(hex: 0x3FA34D)
    static let onSky = Color(hex: 0x0B3D66)
    static let onSkyMuted = Color(hex: 0x2E6A93)
    static let glass = Color.white.opacity(0.6)
    static let glassBorder = Color.white.opacity(0.8)
    static let shellDark = Color(hex: 0x0A3557)
    static let shellMid = Color(hex: 0x3F86B5)
    static let silverLight = Color.white
    static let silver = Color(hex: 0xDDF2FC)
    static let silverDark = Color(hex: 0x8CC8E6)
    static let keyFace = Color(hex: 0xF7FCFF)
    static let keyText = Color(hex: 0x0B3D66)
    static let lcd = Color(hex: 0xD2F5FF)
    static let lcdLight = Color(hex: 0x93DDF7)
    static let lcdDim = Color(hex: 0x7DB4C9)
    static let lcdMid = Color(hex: 0x2C7FB0)
    static let lcdInk = Color(hex: 0x053A5C)
    static let callGreen = Color(hex: 0x3CB64A)
    static let endRed = Color(hex: 0xE2474C)
    static let amber = Color(hex: 0xE07A00)

    static let skyBrush = LinearGradient(
        colors: [skyTop, skyMid, grassTop, grassBottom],
        startPoint: .top,
        endPoint: .bottom
    )
    static let pearlBrush = LinearGradient(
        colors: [.white, silver, silverDark],
        startPoint: .top,
        endPoint: .bottom
    )
}

/// The desktop app's "water Wii" tokens (src/frontend/theme/tokens.css), so screens that
/// mirror the desktop look the same: Wii whites and greys, cyan, and backlit water.
enum Wii {
    static let white = Color.white
    static let surface = Color(hex: 0xF7F9FB)
    static let surfaceSunk = Color(hex: 0xE9EEF2)
    static let line = Color(hex: 0xC9D1D8)
    static let lineSoft = Color(hex: 0xDDE3E8)
    static let ink = Color(hex: 0x3C4650)
    static let inkMuted = Color(hex: 0x8A959F)
    static let cyan100 = Color(hex: 0xDFF5FD)
    static let cyan300 = Color(hex: 0x8EDCF7)
    static let cyan500 = Color(hex: 0x34BEED)
    static let cyan700 = Color(hex: 0x0D97CF)
    static let grass600 = Color(hex: 0x4AA52A)
    static let danger = Color(hex: 0xE2484D)
    static let dockTime = Color(hex: 0x9BA5AE)
    static let waterTop = Color(hex: 0x7FE3FF)
    static let waterMid = Color(hex: 0x1FA2F0)
    static let waterDeep = Color(hex: 0x0A4FB8)
    static let tankGlow = Color(red: 40 / 255, green: 170 / 255, blue: 1, opacity: 0.45)

    static let backdrop = LinearGradient(
        stops: [.init(color: Color(hex: 0xFDFEFF), location: 0), .init(color: Color(hex: 0xEEF2F5), location: 0.6), .init(color: Color(hex: 0xE2E8ED), location: 1)],
        startPoint: .top, endPoint: .bottom
    )
    /// The white-to-grey glossy face of pills and buttons, with the hard split in the middle.
    static let button = LinearGradient(
        stops: [
            .init(color: .white, location: 0), .init(color: Color(hex: 0xF3F6F8), location: 0.5),
            .init(color: Color(hex: 0xE6EBEF), location: 0.51), .init(color: Color(hex: 0xF2F5F7), location: 1),
        ],
        startPoint: .top, endPoint: .bottom
    )
    static let tile = LinearGradient(colors: [.white, Color(hex: 0xF6F8FA), Color(hex: 0xEDF1F4)], startPoint: .top, endPoint: .bottom)
    static let water = LinearGradient(colors: [waterTop, waterMid, waterDeep], startPoint: .top, endPoint: .bottom)
    static let metal = LinearGradient(
        stops: [
            .init(color: Color(hex: 0xFBFCFD), location: 0), .init(color: Color(hex: 0xD9DFE4), location: 0.48),
            .init(color: Color(hex: 0xA9B3BB), location: 0.52), .init(color: Color(hex: 0xD9DFE4), location: 1),
        ],
        startPoint: .top, endPoint: .bottom
    )
    static let dock = LinearGradient(colors: [Color(hex: 0xF4F7F9), Color(hex: 0xE3E9ED)], startPoint: .top, endPoint: .bottom)
    /// The cyan point coin and brand orb.
    static let orb = RadialGradient(colors: [Color(hex: 0xD6F6FF), cyan500, cyan700], center: UnitPoint(x: 0.35, y: 0.3), startRadius: 0, endRadius: 18)
}

func lcdFont(_ size: CGFloat, bold: Bool = false) -> Font {
    .system(size: size, weight: bold ? .bold : .regular, design: .monospaced)
}

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}

func formatClock(_ date: Date = Date()) -> String {
    let f = DateFormatter()
    f.dateFormat = "HH:mm"
    f.locale = Locale(identifier: "en_US_POSIX")
    return f.string(from: date)
}

/// A running session's length: MM:SS, or H:MM:SS from the first hour on.
func formatElapsed(_ seconds: Int) -> String {
    let h = seconds / 3600, m = seconds / 60 % 60, s = seconds % 60
    return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%02d:%02d", m, s)
}

func formatFocusTotal(_ ms: UInt64) -> String {
    let minutes = ms / 60_000
    return minutes >= 60 ? "\(minutes / 60)H \(minutes % 60)M" : "\(minutes) MIN"
}

func formatPoints(_ points: Double) -> String {
    let rounded = points.rounded()
    if abs(points - rounded) < 0.001 {
        return String(Int(rounded))
    }
    return String(format: "%.2f", points)
}
