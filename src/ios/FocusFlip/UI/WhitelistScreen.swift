import SwiftUI
import UIKit

/// Study apps: the apps that can be opened from the lock screen. Styled after the desktop's
/// Study apps panel (src/frontend/views/components/StudyApps.tsx) on its home screen
/// backdrop. Ticking an app saves straight away.
struct WhitelistScreen: View {
    @EnvironmentObject private var model: AppModel
    let onBack: () -> Void
    @State private var query = ""

    private var visible: [CatalogApp] {
        AppCatalog.all.filter {
            query.isEmpty
                || $0.label.localizedCaseInsensitiveContains(query)
                || $0.scheme.localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        ZStack {
            WiiBackdrop()
            VStack(spacing: 14) {
                HStack {
                    Button(action: onBack) {
                        Text("‹ Home")
                            .font(.selawik(15, .semibold))
                            .foregroundStyle(Wii.ink)
                            .padding(.horizontal, 16)
                            .frame(height: 36)
                            .wiiPill()
                    }
                    .buttonStyle(PressScale())
                    Spacer()
                    Text("\(model.whitelist.schemes.count) chosen")
                        .font(.selawik(13, .semibold))
                        .foregroundStyle(Wii.cyan700)
                        .padding(.horizontal, 12)
                        .frame(height: 30)
                        .background(Wii.cyan100)
                        .clipShape(Capsule())
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Study apps")
                        .font(.selawik(18, .semibold))
                        .foregroundStyle(Wii.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.bottom, 8)
                        .overlay(alignment: .bottom) { Wii.lineSoft.frame(height: 2) }

                    Text("Tick the apps you study with. During a Focus session they open from the flip phone's keypad; everything else stays locked.")
                        .font(.selawik(13))
                        .foregroundStyle(Wii.inkMuted)

                    SearchField(text: $query)

                    ScrollView {
                        LazyVStack(spacing: 6) {
                            ForEach(visible) { app in
                                let checked = model.whitelist.contains(app.scheme)
                                AppRow(app: app, checked: checked) {
                                    model.whitelist.set(app.scheme, allowed: !checked)
                                }
                            }
                            if visible.isEmpty {
                                Text("No apps match.")
                                    .font(.selawik(13))
                                    .foregroundStyle(Wii.inkMuted)
                                    .padding(.top, 8)
                            }
                        }
                    }
                    .scrollDismissesKeyboard(.immediately)

                    Text("iPhone apps can't be listed, so these are the apps FocusFlip knows how to open. To keep you in FocusFlip, turn on Guided Access under Settings > Accessibility.")
                        .font(.selawik(12))
                        .foregroundStyle(Wii.inkMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 10)
                        .overlay(alignment: .top) { Wii.lineSoft.frame(height: 2) }

                    HStack {
                        Spacer()
                        Button(action: onBack) {
                            Text("Done")
                                .font(.selawik(16, .semibold))
                                .foregroundStyle(.white)
                                .shadow(color: Color(red: 0, green: 0.31, blue: 0.47, opacity: 0.35), radius: 0.5, y: 1)
                                .padding(.horizontal, 28)
                                .frame(height: 42)
                                .background(
                                    LinearGradient(
                                        stops: [
                                            .init(color: Color(hex: 0x8FE2FF), location: 0), .init(color: Wii.cyan500, location: 0.5),
                                            .init(color: Color(hex: 0x13A7E0), location: 0.51), .init(color: Color(hex: 0x4CC8F2), location: 1),
                                        ],
                                        startPoint: .top, endPoint: .bottom
                                    )
                                )
                                .clipShape(Capsule())
                                .overlay(Capsule().stroke(Wii.cyan700, lineWidth: 2))
                        }
                        .buttonStyle(PressScale())
                    }
                }
                .padding(16)
                .background(Wii.tile)
                .clipShape(RoundedRectangle(cornerRadius: 24))
                .overlay(RoundedRectangle(cornerRadius: 24).stroke(Wii.lineSoft, lineWidth: 2))
                .shadow(color: Color(red: 40 / 255, green: 60 / 255, blue: 80 / 255, opacity: 0.16), radius: 12, y: 8)
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 12)
        }
    }
}

/// The desktop's text box: white, grey border, cyan ring while typing.
private struct SearchField: View {
    @Binding var text: String
    @FocusState private var focused: Bool

    var body: some View {
        TextField("Search apps", text: $text)
            .font(.selawik(15))
            .foregroundStyle(Wii.ink)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .focused($focused)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(focused ? Wii.cyan500 : Wii.line, lineWidth: 2))
            .background(RoundedRectangle(cornerRadius: 10).stroke(Wii.cyan500.opacity(focused ? 0.25 : 0), lineWidth: 6))
    }
}

/// A row like the desktop's: white with a soft border, turning pale cyan once ticked.
private struct AppRow: View {
    let app: CatalogApp
    let checked: Bool
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 5)
                    .fill(checked ? Wii.cyan500 : Color.white)
                    .overlay(RoundedRectangle(cornerRadius: 5).stroke(checked ? Wii.cyan700 : Wii.line, lineWidth: 1.5))
                    .overlay(
                        Image(systemName: "checkmark")
                            .font(.system(size: 11, weight: .heavy))
                            .foregroundStyle(.white)
                            .opacity(checked ? 1 : 0)
                    )
                    .frame(width: 20, height: 20)
                Text(app.label)
                    .font(.selawik(15, .semibold))
                    .foregroundStyle(Wii.ink)
                    .lineLimit(1)
                Spacer()
                Text(app.scheme)
                    .font(.selawik(12))
                    .foregroundStyle(Wii.inkMuted)
                    .lineLimit(1)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(checked ? Wii.cyan100 : Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(checked ? Wii.cyan300 : Wii.lineSoft, lineWidth: 2))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityValue(checked ? "Chosen" : "Not chosen")
    }
}
