import SwiftUI
import UIKit

/// Pick which catalog apps may be opened from the lock screen. Changes save immediately.
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
        AeroBackground {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    RetroLink(text: "< BACK", action: onBack)
                    Spacer()
                    Text("\(model.whitelist.schemes.count) SELECTED")
                        .font(lcdFont(13, bold: true))
                        .foregroundStyle(Palette.onSky)
                }
                .padding(.bottom, 8)

                LcdPanel {
                    Text("WHITELIST").font(lcdFont(22, bold: true)).foregroundStyle(Palette.lcdInk)
                    Text("Checked apps can be opened while locked.")
                        .font(lcdFont(12))
                        .foregroundStyle(Palette.lcdInk)
                    Spacer().frame(height: 8)
                    ZStack(alignment: .leading) {
                        if query.isEmpty {
                            Text("Search apps...")
                                .font(lcdFont(14))
                                .foregroundStyle(Palette.lcdMid)
                        }
                        TextField("", text: $query)
                            .font(lcdFont(14, bold: true))
                            .foregroundStyle(Palette.lcdInk)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(Palette.lcdMid, lineWidth: 2))
                }

                Spacer().frame(height: 12)

                ScrollView {
                    LazyVStack(spacing: 6) {
                        ForEach(visible) { app in
                            let checked = model.whitelist.contains(app.scheme)
                            AppRow(app: app, checked: checked) {
                                model.whitelist.set(app.scheme, allowed: !checked)
                            }
                        }
                    }
                }
            }
            .padding(16)
        }
    }
}

private struct AppRow: View {
    let app: CatalogApp
    let checked: Bool
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(checked ? Palette.lcdMid : Palette.silverDark)
                        .frame(width: 36, height: 36)
                    Text(String(app.label.prefix(1)))
                        .font(lcdFont(16, bold: true))
                        .foregroundStyle(.white)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(app.label)
                        .font(lcdFont(15, bold: true))
                        .foregroundStyle(checked ? Palette.lcdInk : Palette.onSky)
                        .lineLimit(1)
                    Text(app.scheme)
                        .font(lcdFont(10))
                        .foregroundStyle(checked ? Palette.lcdMid : Palette.onSkyMuted)
                        .lineLimit(1)
                }
                Spacer()
                Text(checked ? "[X]" : "[ ]")
                    .font(lcdFont(16, bold: true))
                    .foregroundStyle(checked ? Palette.lcdInk : Palette.onSky)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(checked ? Palette.lcd : Palette.glass)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(checked ? Palette.lcdMid : Palette.glassBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}
