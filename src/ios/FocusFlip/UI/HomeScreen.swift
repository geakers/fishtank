import SwiftUI
import UIKit

/// Laid out after the desktop home screen (src/frontend/views/screens/HomeScreen.tsx), with
/// the flip phone where the desktop has its tank:
///   top bar - brand on the left; points and profile on the right
///   hero    - the flip phone on its stand; tap it or Focus to start a session
///   actions - Focus, then Study apps (the whitelist) and Focus Guard (Guided Access)
///   panel   - study groups
///   dock    - a big grey clock and the date
struct HomeScreen: View {
    @EnvironmentObject private var model: AppModel
    let onOpenWhitelist: () -> Void
    let onOpenGroups: () -> Void

    @Environment(\.scenePhase) private var scenePhase
    @State private var now = Date()
    @State private var showGuardDialog = false
    @State private var showProfile = false
    @State private var guardOn = UIAccessibility.isGuidedAccessEnabled
    /// nil until the first load finishes.
    @State private var groups: [StudyGroup]?
    @State private var invites: [GroupInvite] = []

    private var displayName: String {
        guard let session = model.sessionStore.session else { return "" }
        // The profile's username is the one the desktop and study groups show.
        let name = model.sync.status.username ?? session.user.displayName
        return name.isEmpty ? session.user.email : name
    }

    var body: some View {
        ZStack {
            WiiBackdrop()
            VStack(spacing: 0) {
                TopBar(points: model.sync.status.accountPoints, name: displayName) { showProfile = true }
                    .padding(.horizontal, 16)
                    .padding(.top, 8)

                ScrollView {
                    VStack(spacing: 18) {
                        Button(action: startPressed) {
                            PhoneHero(status: model.sync.status, guardOn: guardOn, now: now)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Start a focus session")

                        HeroButton(text: "Focus", action: startPressed)

                        HStack(spacing: 10) {
                            WiiButton(text: "Study apps", detail: "\(model.whitelist.schemes.count)", action: onOpenWhitelist)
                            WiiButton(text: "Focus Guard", detail: guardOn ? "On" : "Off", warn: !guardOn) {
                                openGuidedAccessSettings()
                            }
                        }

                        GroupsPanel(groups: groups, invites: invites, uid: model.sessionStore.session?.user.id, onOpen: onOpenGroups)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 32)
                    .padding(.bottom, 24)
                }
                .refreshable { await reload() }

                Dock(now: now)
            }
        }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { now = $0 }
        .task { await reload() }
        .onChange(of: scenePhase) { _ in
            guardOn = UIAccessibility.isGuidedAccessEnabled
        }
        .sheet(isPresented: $showProfile) {
            ProfileSheet(name: displayName)
        }
        .alert("Turn on Focus Guard?", isPresented: $showGuardDialog) {
            Button("Open settings") { openGuidedAccessSettings() }
            Button("Start anyway") { model.sessions.startFocus() }
        } message: {
            Text("To keep you inside FocusFlip during a session, turn on Guided Access under Settings > Accessibility, then triple-click the side button after you start.\n\nWithout it the timer still runs, but other apps are not blocked.")
        }
    }

    private func startPressed() {
        if guardOn { model.sessions.startFocus() } else { showGuardDialog = true }
    }

    private func reload() async {
        guardOn = UIAccessibility.isGuidedAccessEnabled
        await model.sync.syncNow()
        if let next = try? await model.groups.listGroups() { groups = next } else if groups == nil { groups = [] }
        invites = (try? await model.groups.myInvites()) ?? []
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

// MARK: - Backdrop and top bar

/// The desktop's backdrop: white fading to grey, with faint Wii pinstripes.
struct WiiBackdrop: View {
    var body: some View {
        ZStack {
            Wii.backdrop
            Canvas { ctx, size in
                var y: CGFloat = 0
                while y < size.height {
                    ctx.fill(Path(CGRect(x: 0, y: y, width: size.width, height: 1)), with: .color(Color(hex: 0x3C4650, alpha: 0.035)))
                    y += 5
                }
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }
}

private struct TopBar: View {
    let points: Double
    let name: String
    let onProfile: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            HStack(spacing: 8) {
                Orb(size: 26)
                Text("FocusFlip").font(.system(size: 19, weight: .semibold)).foregroundStyle(Wii.ink)
            }
            Spacer(minLength: 4)
            HStack(spacing: 5) {
                Orb(size: 20)
                Text(formatPointsGrouped(points)).font(.system(size: 14, weight: .bold)).foregroundStyle(Wii.ink)
                Text("pts").font(.system(size: 12)).foregroundStyle(Wii.inkMuted)
            }
            .lineLimit(1)
            .padding(.leading, 5)
            .padding(.trailing, 12)
            .frame(height: 36)
            .wiiPill()
            Button(action: onProfile) {
                HStack(spacing: 6) {
                    Avatar(name: name, size: 30)
                    Text(name).font(.system(size: 14, weight: .semibold)).foregroundStyle(Wii.ink).lineLimit(1)
                    Text("▾").font(.system(size: 10)).foregroundStyle(Wii.inkMuted)
                }
                .padding(.leading, 3)
                .padding(.trailing, 10)
                .frame(height: 36)
                .frame(maxWidth: 150)
                .wiiPill()
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Profile and stats")
        }
    }
}

/// The cyan orb with a white ring used for the brand and the point coin.
private struct Orb: View {
    let size: CGFloat
    var body: some View {
        Circle()
            .fill(Wii.orb)
            .overlay(Circle().stroke(Color.white, lineWidth: size * 0.11))
            .overlay(Circle().stroke(Wii.cyan700, lineWidth: 1))
            .frame(width: size, height: size)
            .shadow(color: Color(red: 0, green: 0.31, blue: 0.47, opacity: 0.3), radius: 1.5, y: 1)
    }
}

private struct Avatar: View {
    let name: String
    let size: CGFloat
    var body: some View {
        Circle()
            .fill(LinearGradient(colors: [Wii.cyan100, Wii.cyan300], startPoint: .top, endPoint: .bottom))
            .overlay(Text(String(name.prefix(1)).uppercased()).font(.system(size: size * 0.45, weight: .semibold)).foregroundStyle(.white))
            .overlay(Circle().stroke(Color.white, lineWidth: 2))
            .frame(width: size, height: size)
    }
}

extension View {
    /// The glossy white pill the desktop uses for its badge, profile and glass buttons.
    func wiiPill(border: Color = Wii.line) -> some View {
        background(Wii.button)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(border, lineWidth: 2))
            .overlay(Capsule().inset(by: 2).trim(from: 0.5, to: 1).stroke(Color.white.opacity(0.95), lineWidth: 1))
            .shadow(color: Color(red: 40 / 255, green: 60 / 255, blue: 80 / 255, opacity: 0.1), radius: 3, y: 2)
    }
}

// MARK: - Hero: the flip phone on its stand

/// Where the desktop shows its tank: the flip phone, open and idle, in front of backlit
/// water, standing on the same brushed-silver stand.
private struct PhoneHero: View {
    let status: SyncStatus
    let guardOn: Bool
    let now: Date

    var body: some View {
        VStack(spacing: 0) {
            MiniPhone(status: status, guardOn: guardOn, now: now)
                .padding(.horizontal, 34)
                .padding(.bottom, 10)

            // The stand, like the desktop's tank cabinet.
            Wii.metal
                .frame(height: 16)
                .clipShape(RoundedRectangle(cornerRadius: 4))
                .overlay(RoundedRectangle(cornerRadius: 4).stroke(Wii.line, lineWidth: 1))
                .padding(.horizontal, -4)
            Wii.tile
                .frame(height: 26)
                .overlay(Rectangle().stroke(Wii.lineSoft, lineWidth: 1).padding(5))
                .overlay(Wii.lineSoft.frame(width: 1).padding(.vertical, 5))
                .padding(.horizontal, 8)
        }
    }
}

/// An idle copy of the lock screen's flip phone, as wide as the screen: lid with the LCD, hinge, keypad.
private struct MiniPhone: View {
    let status: SyncStatus
    let guardOn: Bool
    let now: Date

    var body: some View {
        VStack(spacing: 0) {
            // Lid
            VStack(spacing: 6) {
                Capsule().fill(Palette.shellDark).frame(width: 56, height: 5)
                LcdPanel {
                    VStack(alignment: .leading, spacing: 0) {
                        LcdStatusBar(now: now)
                        Spacer().frame(height: 6)
                        Palette.lcdMid.frame(height: 1)
                        Spacer().frame(height: 22)
                        Text("READY").font(lcdFont(13, bold: true)).foregroundStyle(Palette.lcdMid)
                        Text(formatElapsed(0)).font(lcdFont(52, bold: true)).foregroundStyle(Palette.lcdInk)
                        Text("PRESS FOCUS").font(lcdFont(13, bold: true)).foregroundStyle(Palette.lcdInk)
                        Spacer().frame(height: 28)
                        MiniLine(label: "TOTAL", value: formatFocusTotal(status.accountFocusMs))
                        MiniLine(label: "TODAY", value: "\(status.todayFocusMinutes) MIN")
                        MiniLine(label: "GUARD", value: guardOn ? "ON" : "OFF")
                        Spacer().frame(height: 14)
                    }
                }
                Text("FOCUSFLIP").font(lcdFont(11, bold: true)).foregroundStyle(Palette.shellMid)
            }
            .padding(12)
            .background(Palette.pearlBrush)
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 24, bottomLeadingRadius: 8, bottomTrailingRadius: 8, topTrailingRadius: 24))
            .overlay(UnevenRoundedRectangle(topLeadingRadius: 24, bottomLeadingRadius: 8, bottomTrailingRadius: 8, topTrailingRadius: 24).stroke(Color.white, lineWidth: 1.5))

            // Hinge
            RoundedRectangle(cornerRadius: 5)
                .fill(LinearGradient(colors: [Palette.silverDark, Palette.silverLight, Palette.silverDark], startPoint: .top, endPoint: .bottom))
                .frame(height: 12)
                .padding(.horizontal, 28)

            // Keypad (decoration only)
            VStack(spacing: 10) {
                HStack(spacing: 14) {
                    MiniKey(color: Palette.callGreen)
                    Circle().fill(Palette.keyFace).overlay(Circle().stroke(Palette.silverDark, lineWidth: 1)).frame(width: 48, height: 48)
                    MiniKey(color: Palette.endRed)
                }
                .padding(.bottom, 4)
                ForEach(0..<4, id: \.self) { _ in
                    HStack(spacing: 10) { ForEach(0..<3, id: \.self) { _ in MiniKey() } }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .padding(.bottom, 26)
            .background(Palette.pearlBrush)
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 8, bottomLeadingRadius: 24, bottomTrailingRadius: 24, topTrailingRadius: 8))
            .overlay(UnevenRoundedRectangle(topLeadingRadius: 8, bottomLeadingRadius: 24, bottomTrailingRadius: 24, topTrailingRadius: 8).stroke(Color.white, lineWidth: 1.5))
        }
        .frame(maxWidth: .infinity)
        .shadow(color: Color(red: 40 / 255, green: 60 / 255, blue: 80 / 255, opacity: 0.22), radius: 14, y: 8)
    }
}

private struct MiniLine: View {
    let label: String
    let value: String
    var body: some View {
        HStack {
            Text(label).font(lcdFont(13, bold: true))
            Spacer()
            Text(value).font(lcdFont(13)).lineLimit(1)
        }
        .foregroundStyle(Palette.lcdInk)
    }
}

private struct MiniKey: View {
    var color: Color = Palette.keyFace
    var body: some View {
        Capsule()
            .fill(color)
            .overlay(Capsule().stroke(Palette.silverDark.opacity(0.8), lineWidth: 1))
            .frame(maxWidth: .infinity)
            .frame(height: 24)
    }
}

// MARK: - Buttons

/// The desktop's big Focus pill: white glass, cyan ring, a soft pulsing glow.
private struct HeroButton: View {
    let text: String
    let action: () -> Void
    @State private var glow = false

    var body: some View {
        Button(action: action) {
            Text(text)
                .font(.system(size: 30, weight: .semibold))
                .tracking(1.2)
                .foregroundStyle(Wii.cyan700)
                .frame(maxWidth: .infinity)
                .frame(height: 72)
                .background(Wii.button)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(Wii.cyan500, lineWidth: 3))
                .background(
                    Capsule()
                        .fill(Wii.cyan500.opacity(glow ? 0.22 : 0.12))
                        .padding(glow ? -10 : -4)
                )
                .shadow(color: Color(red: 40 / 255, green: 60 / 255, blue: 80 / 255, opacity: 0.16), radius: 12, y: 8)
        }
        .buttonStyle(PressScale())
        .padding(.horizontal, 24)
        .onAppear {
            withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) { glow = true }
        }
    }
}

/// The desktop's glass buttons (Study apps, Strict lock-in).
private struct WiiButton: View {
    let text: String
    var detail: String?
    var warn = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(text).font(.system(size: 15, weight: .semibold)).foregroundStyle(Wii.ink)
                if let detail {
                    Text(detail)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(warn ? Wii.danger : Wii.cyan700)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 42)
            .wiiPill()
        }
        .buttonStyle(PressScale())
    }
}

struct PressScale: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

// MARK: - Study groups panel

/// The desktop's study groups panel, in brief: invites waiting and the user's groups.
/// Tapping it opens the full study groups screen.
private struct GroupsPanel: View {
    let groups: [StudyGroup]?
    let invites: [GroupInvite]
    let uid: String?
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Study groups").font(.system(size: 16, weight: .semibold)).foregroundStyle(Wii.ink)
                    Spacer()
                    Text("Open ›").font(.system(size: 13, weight: .semibold)).foregroundStyle(Wii.cyan700)
                }
                .padding(.bottom, 6)
                .overlay(alignment: .bottom) { Wii.lineSoft.frame(height: 2) }

                ForEach(invites.prefix(2)) { invite in
                    HStack(spacing: 8) {
                        Circle().fill(Wii.cyan500).frame(width: 8, height: 8)
                        Text(invite.groupName).font(.system(size: 14, weight: .semibold)).foregroundStyle(Wii.ink).lineLimit(1)
                        Text("invite from \(invite.leader)").font(.system(size: 12)).foregroundStyle(Wii.inkMuted).lineLimit(1)
                        Spacer(minLength: 0)
                    }
                }

                if groups == nil {
                    Text("Loading…").font(.system(size: 13)).foregroundStyle(Wii.inkMuted)
                } else if let groups, groups.isEmpty && invites.isEmpty {
                    Text("No study groups yet. Tap to start one.").font(.system(size: 13)).foregroundStyle(Wii.inkMuted)
                }
                ForEach((groups ?? []).prefix(4)) { group in
                    HStack(spacing: 8) {
                        Text(group.name).font(.system(size: 14)).foregroundStyle(Wii.ink).lineLimit(1)
                        if group.leaderId == uid {
                            Text("Leader")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Wii.cyan700)
                                .padding(.horizontal, 7)
                                .padding(.vertical, 2)
                                .background(Wii.cyan100)
                                .clipShape(Capsule())
                        }
                        Spacer(minLength: 0)
                    }
                }
                if let groups, groups.count > 4 {
                    Text("+\(groups.count - 4) more").font(.system(size: 12)).foregroundStyle(Wii.inkMuted)
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Wii.tile)
            .clipShape(RoundedRectangle(cornerRadius: 24))
            .overlay(RoundedRectangle(cornerRadius: 24).stroke(Wii.lineSoft, lineWidth: 2))
            .shadow(color: Color(red: 40 / 255, green: 60 / 255, blue: 80 / 255, opacity: 0.12), radius: 12, y: 6)
        }
        .buttonStyle(PressScale())
    }
}

// MARK: - Dock

/// The Wii-menu dock: big grey time with the date under it.
private struct Dock: View {
    let now: Date

    var body: some View {
        VStack(spacing: 2) {
            Text(now, format: .dateTime.hour().minute())
                .font(.system(size: 38, weight: .light))
                .monospacedDigit()
            Text(now, format: .dateTime.weekday(.abbreviated).month(.defaultDigits).day().year(.twoDigits))
                .font(.system(size: 13, weight: .semibold))
        }
        .foregroundStyle(Wii.dockTime)
        .frame(maxWidth: .infinity)
        .padding(.top, 10)
        .padding(.bottom, 4)
        .background(
            Wii.dock
                .overlay(alignment: .top) { Wii.line.frame(height: 2) }
                .shadow(color: Color(red: 40 / 255, green: 60 / 255, blue: 80 / 255, opacity: 0.08), radius: 7, y: -4)
                .ignoresSafeArea(edges: .bottom)
        )
    }
}

// MARK: - Profile sheet

/// The desktop's profile menu: the user, their stats as tiles, sync and log out.
private struct ProfileSheet: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let name: String
    @State private var confirmLogout = false

    private var status: SyncStatus { model.sync.status }

    var body: some View {
        ZStack {
            WiiBackdrop()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 12) {
                        Avatar(name: name, size: 48)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(name).font(.system(size: 20, weight: .semibold)).foregroundStyle(Wii.ink)
                            Text(model.sessionStore.session?.user.email ?? "").font(.system(size: 13)).foregroundStyle(Wii.inkMuted)
                        }
                        Spacer()
                        Button("Done") { dismiss() }.font(.system(size: 15, weight: .semibold)).tint(Wii.cyan700)
                    }

                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                        StatTile(value: formatPointsGrouped(status.accountPoints), label: "Points")
                        StatTile(value: formatFocusTotal(status.accountFocusMs).lowercased(), label: "Focus time")
                        StatTile(value: "\(status.todayFocusMinutes) min", label: "Today")
                        StatTile(value: "\(status.todaySessions)", label: "Sessions today")
                    }

                    if !status.pointsValid {
                        Text("Your points don't match your study time.").font(.system(size: 13, weight: .semibold)).foregroundStyle(Wii.danger)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Sync").font(.system(size: 13, weight: .semibold)).foregroundStyle(Wii.inkMuted)
                        Text(syncLabel).font(.system(size: 14)).foregroundStyle(Wii.ink)
                        if let err = status.lastError {
                            Text(err).font(.system(size: 13, weight: .semibold)).foregroundStyle(Wii.danger)
                        }
                    }

                    HStack(spacing: 10) {
                        WiiButton(text: status.isSyncing ? "Syncing…" : "Sync now") {
                            Task { await model.sync.syncNow() }
                        }
                        WiiButton(text: "Log out") { confirmLogout = true }
                    }
                }
                .padding(20)
            }
        }
        .presentationDetents([.medium, .large])
        .alert("Log out?", isPresented: $confirmLogout) {
            Button("Log out", role: .destructive) {
                dismiss()
                Task { await model.logOut() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("You will need to sign in again next time.")
        }
    }

    private var syncLabel: String {
        let pending = status.pendingCount
        let synced = status.lastSyncAt.map { "Last synced \(formatClock($0))" } ?? "Never synced"
        // Only mention sessions when some are still waiting to be saved.
        return pending == 0 ? synced : "\(synced), \(pending) session\(pending == 1 ? "" : "s") waiting"
    }
}

private struct StatTile: View {
    let value: String
    let label: String
    var body: some View {
        VStack(spacing: 2) {
            Text(value).font(.system(size: 22, weight: .semibold)).foregroundStyle(Wii.cyan700).lineLimit(1).minimumScaleFactor(0.6)
            Text(label).font(.system(size: 13)).foregroundStyle(Wii.inkMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Wii.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Wii.lineSoft, lineWidth: 2))
    }
}

/// Points with thousands separators, like the desktop badge (100,000).
private func formatPointsGrouped(_ points: Double) -> String {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.maximumFractionDigits = abs(points - points.rounded()) < 0.001 ? 0 : 2
    return f.string(from: NSNumber(value: points)) ?? formatPoints(points)
}
