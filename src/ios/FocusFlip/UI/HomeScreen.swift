import SwiftUI
import UIKit

struct HomeScreen: View {
    @EnvironmentObject private var model: AppModel
    let onOpenWhitelist: () -> Void

    @Environment(\.scenePhase) private var scenePhase
    @State private var now = Date()
    @State private var showGuardDialog = false
    @State private var showLogoutDialog = false
    @State private var guardOn = UIAccessibility.isGuidedAccessEnabled

    private var displayName: String {
        guard let session = model.sessionStore.session else { return "" }
        let name = session.user.displayName
        return name.isEmpty ? session.user.email : name
    }

    var body: some View {
        AeroBackground {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("FOCUSFLIP")
                        .font(lcdFont(14, bold: true))
                        .foregroundStyle(Palette.onSky)
                        .frame(maxWidth: .infinity)

                    LcdPanel {
                        LcdStatusBar(now: now)
                        Spacer().frame(height: 12)
                        Text("HELLO,").font(lcdFont(14)).foregroundStyle(Palette.lcdInk)
                        Text(displayName.uppercased())
                            .font(lcdFont(22, bold: true))
                            .foregroundStyle(Palette.lcdInk)
                            .lineLimit(1)
                        Spacer().frame(height: 10)
                        LcdLine(label: "TOTAL", value: formatFocusTotal(model.sync.status.accountFocusMs))
                        LcdLine(label: "POINTS", value: formatPoints(model.sync.status.accountPoints))
                        LcdLine(label: "TODAY", value: "\(model.sync.status.todayFocusMinutes) MIN / \(model.sync.status.todaySessions) BLOCKS")
                        LcdLine(label: "WHITELIST", value: "\(model.whitelist.schemes.count) APPS")
                        LcdLine(label: "GUARD", value: guardOn ? "ON" : "OFF")
                        LcdLine(label: "SYNC", value: syncLabel)
                        if let err = model.sync.status.lastError {
                            Text("! \(err)").font(lcdFont(11)).foregroundStyle(Palette.lcdInk)
                        }
                    }

                    if !guardOn {
                        Text("Focus Guard is OFF. Tap here to enable Guided Access in Accessibility settings, otherwise other apps cannot be blocked.")
                            .font(lcdFont(12, bold: true))
                            .foregroundStyle(Palette.amber)
                            .onTapGesture { openGuidedAccessSettings() }
                    }

                    RetroButton(
                        text: "START LOCK",
                        subtitle: "45 min focus / 15 min break",
                        accent: Palette.endRed,
                        height: 92,
                        textSize: 26,
                        action: { if guardOn { startLock() } else { showGuardDialog = true } }
                    )
                    RetroButton(
                        text: "WHITELIST",
                        subtitle: "Apps allowed while locked",
                        accent: Palette.callGreen,
                        height: 92,
                        textSize: 26,
                        action: onOpenWhitelist
                    )

                    HStack {
                        RetroLink(text: "SYNC NOW") {
                            Task { await model.sync.syncNow() }
                        }
                        Spacer()
                        RetroLink(text: "LOG OUT") { showLogoutDialog = true }
                    }

                }
                .padding(20)
            }
        }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { now = $0 }
        .onAppear {
            guardOn = UIAccessibility.isGuidedAccessEnabled
            Task { await model.sync.syncNow() }
        }
        .onChange(of: scenePhase) { _ in
            guardOn = UIAccessibility.isGuidedAccessEnabled
        }
        .alert("Enable Focus Guard", isPresented: $showGuardDialog) {
            Button("Open settings") { openGuidedAccessSettings() }
            Button("Start anyway") { startLock() }
        } message: {
            Text("To keep you inside FocusFlip during a focus block, turn on Guided Access under Settings > Accessibility.\n\nWithout it the timer still runs, but other apps are not blocked.")
        }
        .alert("Log out?", isPresented: $showLogoutDialog) {
            Button("Log out", role: .destructive) {
                Task { await model.auth.logout() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("You will need to sign in again next time.")
        }
    }

    private var syncLabel: String {
        let pending = model.sync.status.pendingCount
        if model.sync.status.isSyncing { return "SYNCING..." }
        if let last = model.sync.status.lastSyncAt {
            return "\(formatClock(last))  (\(pending) PENDING)"
        }
        return "NEVER  (\(pending) PENDING)"
    }

    private func startLock() {
        model.sessions.startFocus()
    }

    private func openGuidedAccessSettings() {
        let fallback = URL(string: UIApplication.openSettingsURLString)
        if let url = URL(string: "App-Prefs:root=ACCESSIBILITY") {
            UIApplication.shared.open(url, options: [:]) { ok in
                if !ok, let fallback { UIApplication.shared.open(fallback) }
            }
            return
        }
        if let fallback { UIApplication.shared.open(fallback) }
    }
}

private struct LcdLine: View {
    let label: String
    let value: String
    var body: some View {
        HStack(spacing: 0) {
            Text(label.padded(10)).font(lcdFont(13, bold: true)).foregroundStyle(Palette.lcdInk)
            Text(value).font(lcdFont(13)).foregroundStyle(Palette.lcdInk).lineLimit(1)
            Spacer(minLength: 0)
        }
    }
}

private extension String {
    func padded(_ width: Int) -> String {
        count >= width ? self : self + String(repeating: " ", count: width - count)
    }
}
