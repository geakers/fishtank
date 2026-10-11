import SwiftUI
import UIKit

struct AeroBackground<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        ZStack {
            Palette.skyBrush.ignoresSafeArea()
            AeroBubbles()
            content()
        }
    }
}

struct AeroBubbles: View {
    private let bubbles: [(CGFloat, CGFloat, CGFloat)] = [
        (0.12, 0.10, 0.07), (0.82, 0.07, 0.05), (0.90, 0.28, 0.09),
        (0.06, 0.42, 0.05), (0.70, 0.55, 0.04), (0.20, 0.70, 0.08),
        (0.88, 0.80, 0.06), (0.45, 0.92, 0.05),
    ]

    var body: some View {
        GeometryReader { geo in
            ForEach(Array(bubbles.enumerated()), id: \.offset) { _, b in
                let r = b.2 * geo.size.width
                Circle()
                    .stroke(Color.white.opacity(0.55), lineWidth: 1.2)
                    .background(Circle().fill(Color.white.opacity(0.12)))
                    .frame(width: r * 2, height: r * 2)
                    .overlay(alignment: .topLeading) {
                        Circle().fill(Color.white.opacity(0.7)).frame(width: r * 0.5, height: r * 0.5).offset(x: r * 0.35, y: r * 0.3)
                    }
                    .position(x: b.0 * geo.size.width, y: b.1 * geo.size.height)
            }
        }
        .allowsHitTesting(false)
    }
}

struct LcdPanel<Content: View>: View {
    var backlight: Bool = true
    var fillHeight: Bool = false
    @ViewBuilder var content: () -> Content

    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(hex: 0x1C5F8C), Color(hex: 0x062A47)], startPoint: .top, endPoint: .bottom)
            // One stack, so several views passed in are laid out in a column rather than each
            // getting its own padding and background on top of the others.
            VStack(alignment: .leading, spacing: 0, content: content)
                .padding(10)
                .frame(maxWidth: .infinity, maxHeight: fillHeight ? .infinity : nil, alignment: .topLeading)
                .background(
                    LinearGradient(
                        colors: backlight ? [Palette.lcd, Palette.lcdLight] : [Palette.lcdDim, Color(hex: 0x5A8FA5)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .overlay(Scanlines())
                .overlay(alignment: .top) {
                    LinearGradient(colors: [Color.white.opacity(0.4), .clear], startPoint: .top, endPoint: .bottom)
                        .frame(height: 28)
                }
                .padding(6)
        }
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.white.opacity(0.5), lineWidth: 1))
    }
}

struct Scanlines: View {
    var body: some View {
        Canvas { ctx, size in
            var y: CGFloat = 0
            while y < size.height {
                var p = Path()
                p.move(to: CGPoint(x: 0, y: y))
                p.addLine(to: CGPoint(x: size.width, y: y))
                ctx.stroke(p, with: .color(Color(hex: 0x053A5C, alpha: 0.08)), lineWidth: 1)
                y += 3
            }
        }
        .allowsHitTesting(false)
    }
}

struct LcdStatusBar: View {
    var now: Date = Date()
    var body: some View {
        HStack(spacing: 6) {
            SignalBars()
            Text("FOCUS-NET").font(lcdFont(11, bold: true)).foregroundStyle(Palette.lcdInk)
            Spacer()
            Text(formatClock(now)).font(lcdFont(12, bold: true)).foregroundStyle(Palette.lcdInk)
            BatteryPips()
        }
    }
}

private struct SignalBars: View {
    var body: some View {
        HStack(alignment: .bottom, spacing: 2) {
            ForEach(1...4, id: \.self) { i in
                Rectangle().fill(Palette.lcdInk).frame(width: 3, height: CGFloat(3 + i * 2))
            }
        }
        .frame(width: 22, height: 12)
    }
}

private struct BatteryPips: View {
    var body: some View {
        HStack(spacing: 1) {
            ForEach(0..<3, id: \.self) { _ in
                Rectangle().fill(Palette.lcdInk).frame(width: 5, height: 8)
            }
        }
        .padding(2)
        .overlay(RoundedRectangle(cornerRadius: 1).stroke(Palette.lcdInk, lineWidth: 1))
        .frame(width: 24, height: 12)
    }
}

struct LcdProgress: View {
    var progress: CGFloat
    var segments: Int = 20
    var body: some View {
        GeometryReader { geo in
            let gap: CGFloat = 2
            let w = (geo.size.width - gap * CGFloat(segments - 1)) / CGFloat(segments)
            let filled = Int(min(max(progress, 0), 1) * CGFloat(segments))
            HStack(spacing: gap) {
                ForEach(0..<segments, id: \.self) { i in
                    Rectangle()
                        .fill(i < filled ? Palette.lcdInk : Color.clear)
                        .overlay(Rectangle().stroke(Palette.lcdMid, lineWidth: i < filled ? 0 : 1))
                        .frame(width: w)
                }
            }
        }
        .frame(height: 10)
    }
}

struct RetroButton: View {
    let text: String
    var subtitle: String? = nil
    var accent: Color? = nil
    var height: CGFloat = 64
    var textSize: CGFloat = 20
    var enabled: Bool = true
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                if let accent {
                    Circle()
                        .fill(RadialGradient(colors: [accent.opacity(0.7), accent], center: .center, startRadius: 0, endRadius: 8))
                        .frame(width: 14, height: 14)
                        .overlay(Circle().fill(Color.white.opacity(0.7)).frame(width: 5, height: 5).offset(x: -2, y: -2), alignment: .center)
                }
                VStack(spacing: 2) {
                    Text(text).font(lcdFont(textSize, bold: true)).foregroundStyle(Palette.keyText)
                    if let subtitle {
                        Text(subtitle).font(lcdFont(11)).foregroundStyle(Palette.onSkyMuted)
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .background(
                LinearGradient(colors: enabled ? [.white, Palette.silver, Palette.silverDark] : [Color(hex: 0xDDE7EE), Color(hex: 0xB9C9D4)], startPoint: .top, endPoint: .bottom)
            )
            .overlay(
                LinearGradient(colors: [Color.white.opacity(0.75), .clear], startPoint: .top, endPoint: .center)
            )
            .clipShape(RoundedRectangle(cornerRadius: height / 2.6))
            .overlay(RoundedRectangle(cornerRadius: height / 2.6).stroke(Color.white, lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}

struct RetroLink: View {
    let text: String
    var color: Color = Palette.onSky
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(text)
                .font(lcdFont(13, bold: true))
                .foregroundStyle(color)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Palette.glass)
                .clipShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
    }
}

struct RetroField: View {
    let label: String
    @Binding var text: String
    var isPassword: Bool = false
    var keyboard: UIKeyboardType = .default

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(lcdFont(11, bold: true)).foregroundStyle(Palette.onSky)
            Group {
                if isPassword {
                    SecureField("", text: $text)
                } else {
                    TextField("", text: $text)
                }
            }
            .font(lcdFont(16, bold: true))
            .foregroundStyle(Palette.lcdInk)
            .keyboardType(keyboard)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .padding(.horizontal, 12)
            .padding(.vertical, 12)
            .background(Palette.lcd)
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(Palette.lcdMid, lineWidth: 2))
            .clipShape(RoundedRectangle(cornerRadius: 6))
        }
    }
}
