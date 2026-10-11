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

func formatCountdown(_ ms: UInt64) -> String {
    let total = (ms + 999) / 1000
    return String(format: "%02d:%02d", total / 60, total % 60)
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
