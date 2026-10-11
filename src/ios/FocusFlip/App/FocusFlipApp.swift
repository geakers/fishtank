import SwiftUI

@main
struct FocusFlipApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .preferredColorScheme(.light)
                .task { await model.bootstrap() }
        }
    }
}
