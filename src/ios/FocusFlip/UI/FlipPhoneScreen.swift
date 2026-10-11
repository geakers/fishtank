import SwiftUI
import UIKit

private enum Page { case apps, clock }

private enum Key {
    case up, down, left, right, ok, softLeft, softRight, call, end
    case digit(Character)
}

private let quotes = [
    "One thing at a time.",
    "Future you says thanks.",
    "Deep work, no apps.",
    "Stay. Focus. Win.",
    "Your phone can wait.",
]

/**
 * The whole lock UI: top half is the LCD, bottom half is the keypad.
 * Up/Down choose an item, OK/Call opens it, Left/Right or the right soft key switch pages,
 * End (the red key) ends the session, 1-9 jump straight to that list entry, * toggles the backlight.
 */
struct FlipPhoneScreen: View {
    @EnvironmentObject private var model: AppModel
    @State private var page: Page = .apps
    @State private var selected = 0
    @State private var backlight = true
    @State private var toast: String?
    @State private var confirmEnd = false
    @State private var now = Date()

    private var state: SessionState { model.sessions.state }
    private var apps: [CatalogApp] { model.whitelist.selectedApps }

    private var itemCount: Int { page == .apps ? apps.count : 0 }

    var body: some View {
        ZStack {
            // The same Wii-white pinstripe backdrop as the home screen and the desktop.
            WiiBackdrop()
            // The phone fills the whole display, edge to edge. The display's own rounded
            // corners are the phone's outline, the Dynamic Island sits where the earpiece
            // would be, and the keypad stays clear of the home indicator.
            GeometryReader { geo in
                let safe = windowSafeArea()
                let hinge: CGFloat = 14
                let lidH = (geo.size.height - hinge) / 2.08
                let baseH = geo.size.height - hinge - lidH
                VStack(spacing: 0) {
                    Lid(backlight: backlight, topInset: safe.top) {
                        LcdContent(
                            state: state,
                            apps: apps,
                            page: page,
                            selected: selected,
                            toast: toast,
                            now: now
                        )
                    }
                    .frame(height: lidH)
                    Hinge().frame(height: hinge)
                    Base(onKey: press, bottomInset: safe.bottom)
                        .frame(height: baseH)
                }
            }
            .ignoresSafeArea()

            if model.sessions.showBounceBack {
                BounceBackOverlay { model.sessions.dismissBounceBack() }
            }
        }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { tick in
            now = tick
        }
        .onChange(of: toast) { value in
            guard value != nil else { return }
            Task {
                try? await Task.sleep(nanoseconds: 1_800_000_000)
                if toast == value { toast = nil }
            }
        }
        .alert("End session?", isPresented: $confirmEnd) {
            Button("End session") { model.sessions.stop() }
            Button("Keep focusing", role: .cancel) {}
        } message: {
            let seconds = state.elapsedSeconds()
            Text("You've focused for \(formatElapsed(seconds)). It's saved to your account and earns \(formatPoints(Config.earnings(seconds: seconds).points)) points.")
        }
    }

    private func activate() {
        if page == .clock {
            page = .apps
            return
        }
        if apps.isEmpty {
            toast = "Whitelist is empty"
            return
        }
        if let app = apps[safe: selected] {
            toast = "Opening \(app.label)..."
            AppCatalog.launch(app)
        }
    }

    private func press(_ key: Key) {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        if case .digit(let char) = key {
            model.tones.play(char)
        } else {
            model.tones.play(".")
        }
        switch key {
        case .up:
            if itemCount > 0 { selected = (selected - 1 + itemCount) % itemCount }
        case .down:
            if itemCount > 0 { selected = (selected + 1) % itemCount }
        case .left, .right, .softRight:
            if state.phase == .focus { page = page == .apps ? .clock : .apps }
        case .ok, .softLeft, .call:
            activate()
        case .end:
            // The red END key ends the session, after a confirmation.
            if state.phase == .focus { confirmEnd = true }
        case .digit(let char):
            switch char {
            case "*": backlight.toggle()
            case "#": toast = quotes.randomElement()
            case "1"..."9":
                let index = Int(String(char))! - 1
                if index < itemCount { selected = index }
            default:
                break
            }
        }
    }
}

// MARK: - LCD

private struct LcdContent: View {
    let state: SessionState
    let apps: [CatalogApp]
    let page: Page
    let selected: Int
    let toast: String?
    let now: Date

    private var elapsed: Int { state.elapsedSeconds(now: now) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            LcdStatusBar(now: now)
            Spacer().frame(height: 6)
            Palette.lcdMid.frame(height: 1)
            Spacer().frame(height: 6)

            Group {
                if page == .clock {
                    ClockPage(elapsed: elapsed)
                } else {
                    AppsPage(elapsed: elapsed, apps: apps, selected: selected)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

            if let toast {
                Text(toast)
                    .font(lcdFont(12, bold: true))
                    .foregroundStyle(Palette.lcd)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(Palette.lcdInk)
                Spacer().frame(height: 4)
            }

            let labels = softLabels
            Palette.lcdMid.frame(height: 1)
            HStack {
                Text(labels.0).font(lcdFont(13, bold: true)).foregroundStyle(Palette.lcdInk)
                Spacer()
                Text("MENU").font(lcdFont(11)).foregroundStyle(Palette.lcdInk)
                Spacer()
                Text(labels.1).font(lcdFont(13, bold: true)).foregroundStyle(Palette.lcdInk)
            }
            .padding(.top, 4)
        }
    }

    private var softLabels: (String, String) {
        if page == .clock { return ("Apps", "Apps") }
        return ("Open", "Clock")
    }
}

private struct AppsPage: View {
    let elapsed: Int
    let apps: [CatalogApp]
    let selected: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("FOCUSING").font(lcdFont(14, bold: true)).foregroundStyle(Palette.lcdInk)
                Spacer()
                Text(formatElapsed(elapsed)).font(lcdFont(20, bold: true)).foregroundStyle(Palette.lcdInk)
            }
            Spacer().frame(height: 4)
            // Sweeps across once a minute, so the screen shows the time moving.
            LcdProgress(progress: CGFloat(elapsed % 60) / 60)
            Spacer().frame(height: 4)
            Text("+\(formatPoints(Config.earnings(seconds: elapsed).points)) PTS SO FAR")
                .font(lcdFont(12, bold: true))
                .foregroundStyle(Palette.lcdMid)
            Spacer().frame(height: 8)
            Text("ALLOWED APPS").font(lcdFont(11, bold: true)).foregroundStyle(Palette.lcdMid)
            Spacer().frame(height: 2)

            if apps.isEmpty {
                Text("No apps on the whitelist.\nAdd some from the home screen\nafter this session.")
                    .font(lcdFont(13))
                    .foregroundStyle(Palette.lcdInk)
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 0) {
                            ForEach(Array(apps.enumerated()), id: \.element.id) { index, app in
                                MenuRow(prefix: "\(index + 1)", label: app.label, highlighted: index == selected)
                                    .id(index)
                            }
                        }
                    }
                    .onChange(of: selected) { value in
                        withAnimation { proxy.scrollTo(max(0, value - 2), anchor: .top) }
                    }
                }
            }
        }
    }
}

private struct ClockPage: View {
    let elapsed: Int

    var body: some View {
        VStack(spacing: 0) {
            Spacer()
            Text("FOCUSED FOR").font(lcdFont(13, bold: true)).foregroundStyle(Palette.lcdInk)
            Text(formatElapsed(elapsed))
                .font(lcdFont(54, bold: true))
                .foregroundStyle(Palette.lcdInk)
                .minimumScaleFactor(0.5)
                .lineLimit(1)
            Text("+\(formatPoints(Config.earnings(seconds: elapsed).points)) PTS").font(lcdFont(13, bold: true)).foregroundStyle(Palette.lcdMid)
            Spacer().frame(height: 10)
            LcdProgress(progress: CGFloat(elapsed % 60) / 60)
            Spacer().frame(height: 10)
            Text("PHONE LOCKED").font(lcdFont(13, bold: true)).foregroundStyle(Palette.lcdInk)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}

private struct MenuRow: View {
    let prefix: String
    let label: String
    let highlighted: Bool

    var body: some View {
        HStack(spacing: 8) {
            Text(prefix)
                .font(lcdFont(15, bold: true))
                .foregroundStyle(highlighted ? Palette.lcd : Palette.lcdInk)
            Text(label)
                .font(lcdFont(15, bold: highlighted))
                .foregroundStyle(highlighted ? Palette.lcd : Palette.lcdInk)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 4)
        .background(highlighted ? Palette.lcdInk : Color.clear)
    }
}

// MARK: - Shell

/// The top half. Its outer edges are the display's, so only the corners at the hinge are rounded.
private struct Lid<Content: View>: View {
    var backlight: Bool
    /// The display's top safe area. On a phone with a Dynamic Island or notch, that is the earpiece.
    var topInset: CGFloat
    @ViewBuilder var content: () -> Content

    private var shape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(topLeadingRadius: 0, bottomLeadingRadius: 14, bottomTrailingRadius: 14, topTrailingRadius: 0)
    }

    var body: some View {
        VStack(spacing: 0) {
            if topInset > 24 {
                Spacer().frame(height: topInset - 4)
            } else {
                Capsule()
                    .fill(Palette.shellDark)
                    .frame(width: 70, height: 7)
                    .padding(.top, max(6, topInset))
                    .padding(.bottom, 8)
            }
            LcdPanel(backlight: backlight, fillHeight: true) {
                content()
            }
            .padding(.horizontal, 0)
            Text("FOCUSFLIP")
                .font(lcdFont(12, bold: true))
                .foregroundStyle(Palette.shellMid)
                .padding(.top, 6)
        }
        .padding(.horizontal, 14)
        .padding(.bottom, 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Palette.pearlBrush)
        .clipShape(shape)
        .overlay(shape.stroke(Color.white, lineWidth: 1.5))
    }
}

private struct Hinge: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(LinearGradient(colors: [Palette.silverDark, Palette.silverLight, Palette.silverDark], startPoint: .top, endPoint: .bottom))
            .padding(.horizontal, 24)
    }
}

/// The bottom half, running down to the display's bottom edge.
private struct Base: View {
    var onKey: (Key) -> Void
    /// The display's bottom safe area (the home indicator), kept clear of keys.
    var bottomInset: CGFloat

    private var shape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(topLeadingRadius: 14, bottomLeadingRadius: 0, bottomTrailingRadius: 0, topTrailingRadius: 14)
    }

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 10) {
                VStack {
                    PillKey(label: "—") { onKey(.softLeft) }
                    Spacer()
                    PillKey(label: "CALL", color: Palette.callGreen, textColor: .white) { onKey(.call) }
                }
                .frame(maxWidth: .infinity)
                DPad(onKey: onKey)
                    .frame(maxHeight: .infinity)
                    .aspectRatio(1, contentMode: .fit)
                VStack {
                    PillKey(label: "—") { onKey(.softRight) }
                    Spacer()
                    PillKey(label: "END", color: Palette.endRed, textColor: .white) { onKey(.end) }
                }
                .frame(maxWidth: .infinity)
            }
            .frame(maxHeight: .infinity)

            ForEach(padRows, id: \.0) { _, row in
                HStack(spacing: 10) {
                    ForEach(row, id: \.0) { digit, letters in
                        NumberKey(digit: digit, letters: letters) {
                            onKey(.digit(digit.first!))
                        }
                    }
                }
                .frame(maxHeight: .infinity)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, max(14, bottomInset + 6))
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Palette.pearlBrush)
        .clipShape(shape)
        .overlay(shape.stroke(Color.white, lineWidth: 1.5))
    }
}

private let padRows: [(Int, [(String, String)])] = [
    (0, [("1", ""), ("2", "ABC"), ("3", "DEF")]),
    (1, [("4", "GHI"), ("5", "JKL"), ("6", "MNO")]),
    (2, [("7", "PQRS"), ("8", "TUV"), ("9", "WXYZ")]),
    (3, [("*", "LIGHT"), ("0", "+"), ("#", "TIP")]),
]

private struct NumberKey: View {
    let digit: String
    let letters: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(digit).font(lcdFont(20, bold: true)).foregroundStyle(Palette.keyText)
                if !letters.isEmpty {
                    Text(letters).font(lcdFont(9)).foregroundStyle(Palette.shellMid)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .buttonStyle(FlipKeyStyle(base: Palette.keyFace, corner: 50))
    }
}

private struct PillKey: View {
    let label: String
    var color: Color = Palette.keyFace
    var textColor: Color = Palette.keyText
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(lcdFont(12, bold: true))
                .foregroundStyle(textColor)
                .frame(maxWidth: .infinity)
                .frame(height: 34)
        }
        .buttonStyle(FlipKeyStyle(base: color, corner: 50))
    }
}

private struct DPad: View {
    var onKey: (Key) -> Void

    var body: some View {
        ZStack {
            Circle()
                .fill(RadialGradient(colors: [Palette.silverLight, Palette.silver, Palette.silverDark], center: .center, startRadius: 4, endRadius: 80))
            Circle().stroke(Color.white, lineWidth: 2)
            Arrow(rotation: 0) { onKey(.up) }.frame(maxHeight: .infinity, alignment: .top)
            Arrow(rotation: 180) { onKey(.down) }.frame(maxHeight: .infinity, alignment: .bottom)
            Arrow(rotation: 270) { onKey(.left) }.frame(maxWidth: .infinity, alignment: .leading)
            Arrow(rotation: 90) { onKey(.right) }.frame(maxWidth: .infinity, alignment: .trailing)
            Button { onKey(.ok) } label: {
                Text("OK")
                    .font(lcdFont(14, bold: true))
                    .foregroundStyle(Palette.keyText)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .buttonStyle(FlipKeyStyle(base: Palette.keyFace, corner: 100))
            .frame(width: nil, height: nil)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(28)
        }
        .aspectRatio(1, contentMode: .fit)
    }
}

private struct Arrow: View {
    let rotation: Double
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Triangle()
                .fill(Palette.shellMid)
                .rotationEffect(.degrees(rotation))
                .frame(width: 14, height: 12)
                .padding(10)
        }
        .buttonStyle(.plain)
    }
}

private struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.midX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY * 0.8))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.maxY * 0.8))
        p.closeSubpath()
        return p
    }
}

private struct FlipKeyStyle: ButtonStyle {
    var base: Color
    var corner: CGFloat

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(
                LinearGradient(
                    colors: configuration.isPressed
                        ? [base.mix(with: .black, amount: 0.12), base.mix(with: .black, amount: 0.2)]
                        : [base.mix(with: .white, amount: 0.35), base, base.mix(with: Palette.silverDark, amount: 0.35)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .overlay(
                LinearGradient(colors: [Color.white.opacity(0.85), .clear], startPoint: .top, endPoint: .center)
            )
            .clipShape(RoundedRectangle(cornerRadius: corner))
            .overlay(RoundedRectangle(cornerRadius: corner).stroke(Palette.silverDark, lineWidth: 1))
    }
}

private struct BounceBackOverlay: View {
    let onTap: () -> Void

    var body: some View {
        ZStack {
            WiiBackdrop()
            Text("FOCUSFLIP\n\nPHONE LOCKED\n\nThis app is not on\nyour whitelist.\n\n[ TAP TO RETURN ]")
                .font(lcdFont(20, bold: true))
                .foregroundStyle(Palette.lcdInk)
                .multilineTextAlignment(.center)
                .padding(24)
                .frame(maxWidth: .infinity)
                .background(Palette.lcd)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: 0x062A47), lineWidth: 6))
                .padding(.horizontal, 28)
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
    }
}

/// The key window's safe area. Read from the window because the phone ignores the
/// safe area, which would make its own GeometryProxy report zero insets.
@MainActor
private func windowSafeArea() -> UIEdgeInsets {
    UIApplication.shared.connectedScenes
        .compactMap { ($0 as? UIWindowScene)?.keyWindow }
        .first?.safeAreaInsets ?? .zero
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

private extension Color {
    func mix(with other: Color, amount: Double) -> Color {
        let a = UIColor(self)
        let b = UIColor(other)
        var ar: CGFloat = 0, ag: CGFloat = 0, ab: CGFloat = 0, aa: CGFloat = 0
        var br: CGFloat = 0, bg: CGFloat = 0, bb: CGFloat = 0, ba: CGFloat = 0
        a.getRed(&ar, green: &ag, blue: &ab, alpha: &aa)
        b.getRed(&br, green: &bg, blue: &bb, alpha: &ba)
        return Color(
            red: ar * (1 - amount) + br * amount,
            green: ag * (1 - amount) + bg * amount,
            blue: ab * (1 - amount) + bb * amount,
            opacity: aa * (1 - amount) + ba * amount
        )
    }
}
