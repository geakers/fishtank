import SwiftUI

private enum Screen { case home, whitelist, groups }

/// auth -> home -> whitelist / study groups, and a running session always takes over the app.
struct RootView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.scenePhase) private var scenePhase
    @State private var screen: Screen = .home

    var body: some View {
        Group {
            if model.sessionStore.session == nil {
                AuthScreen()
            } else if model.sessions.state.phase != .idle {
                FlipPhoneScreen()
                    .statusBarHidden(true)
                    .persistentSystemOverlays(.hidden)
                    .defersSystemGestures(on: .all)
            } else if screen == .whitelist {
                WhitelistScreen(onBack: { screen = .home })
            } else if screen == .groups {
                StudyGroupsScreen(onBack: { screen = .home })
            } else {
                HomeScreen(onOpenWhitelist: { screen = .whitelist }, onOpenGroups: { screen = .groups })
            }
        }
        .animation(.easeInOut(duration: 0.2), value: model.sessions.state.phase)
        .onChange(of: scenePhase) { phase in
            model.sessions.handleScene(phase)
        }
    }
}
