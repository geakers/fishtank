import Foundation

final class SessionStore: ObservableObject {
    private let key = "focusflip_session"
    @Published private(set) var session: AuthSession?

    init() { session = read() }

    func save(_ session: AuthSession) {
        if let data = try? JSONEncoder().encode(session) {
            UserDefaults.standard.set(data, forKey: key)
        }
        publish { self.session = session }
    }

    func clear() {
        UserDefaults.standard.removeObject(forKey: key)
        publish { self.session = nil }
    }

    private func publish(_ change: @escaping () -> Void) {
        if Thread.isMainThread {
            change()
        } else {
            DispatchQueue.main.sync(execute: change)
        }
    }

    private func read() -> AuthSession? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(AuthSession.self, from: data)
    }
}
