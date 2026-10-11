import SwiftUI

/// Login / register. On success the session is persisted, so this screen is shown only once.
struct AuthScreen: View {
    @EnvironmentObject private var model: AppModel
    @State private var registerMode = false
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirm = ""
    @State private var error: String?
    @State private var loading = false
    @State private var now = Date()

    var body: some View {
        AeroBackground {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Color.clear.frame(height: 12)
                    LcdPanel {
                        LcdStatusBar(now: now)
                        Spacer().frame(height: 14)
                        Text("FOCUSFLIP").font(lcdFont(30, bold: true)).foregroundStyle(Palette.lcdInk)
                        Text("Phone + desktop focus sync").font(lcdFont(12)).foregroundStyle(Palette.lcdInk)
                        Spacer().frame(height: 10)
                        Text(registerMode ? "> CREATE ACCOUNT" : "> SIGN IN")
                            .font(lcdFont(16, bold: true))
                            .foregroundStyle(Palette.lcdInk)
                    }

                    HStack(spacing: 10) {
                        ModeTab(label: "LOGIN", selected: !registerMode) {
                            registerMode = false
                            error = nil
                        }
                        ModeTab(label: "REGISTER", selected: registerMode) {
                            registerMode = true
                            error = nil
                        }
                    }

                    if registerMode {
                        RetroField(label: "NAME", text: $name)
                    }
                    RetroField(label: "EMAIL", text: $email, keyboard: .emailAddress)
                    RetroField(label: "PASSWORD", text: $password, isPassword: true)
                    if registerMode {
                        RetroField(label: "CONFIRM PASSWORD", text: $confirm, isPassword: true)
                    }

                    if let error {
                        Text("! \(error)")
                            .font(lcdFont(13, bold: true))
                            .foregroundStyle(Palette.amber)
                    }

                    RetroButton(
                        text: loading ? "CONNECTING..." : (registerMode ? "CREATE ACCOUNT" : "LOG IN"),
                        accent: Palette.callGreen,
                        enabled: !loading,
                        action: submit
                    )
                }
                .padding(20)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { now = $0 }
    }

    private func submit() {
        error = validate()
        if error != nil { return }
        loading = true
        Task {
            let result = registerMode
                ? await model.auth.register(username: name, email: email, password: password)
                : await model.auth.login(email: email, password: password)
            loading = false
            if case .failure(let message) = result {
                error = message
            }
        }
    }

    private func validate() -> String? {
        if registerMode && name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Please enter your name."
        }
        if !isValidEmail(email) { return "Please enter a valid email." }
        if password.count < 6 { return "Password must be at least 6 characters." }
        if registerMode && password != confirm { return "Passwords do not match." }
        return nil
    }
}

private func isValidEmail(_ email: String) -> Bool {
    let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.range(of: #"^[A-Z0-9a-z._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$"#, options: .regularExpression) != nil
}

private struct ModeTab: View {
    let label: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(lcdFont(14, bold: true))
                .foregroundStyle(selected ? Palette.lcdInk : Palette.onSky)
                .frame(maxWidth: .infinity)
                .frame(height: 40)
                .background(selected ? Palette.lcd : Palette.glass)
                .overlay(
                    LinearGradient(colors: [Color.white.opacity(0.5), .clear], startPoint: .top, endPoint: .center)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(selected ? Palette.lcdMid : Palette.glassBorder, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}
