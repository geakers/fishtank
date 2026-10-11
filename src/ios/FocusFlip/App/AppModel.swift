import Combine
import SwiftUI

/// Wires the same pieces as Android ServiceLocator and forwards nested publishers.
@MainActor
final class AppModel: ObservableObject {
    let sessionStore: SessionStore
    let auth: AuthRepository
    let sync: SyncRepository
    let whitelist: WhitelistStore
    let sessions: SessionManager
    let tones = TonePlayer()

    private var bag = Set<AnyCancellable>()

    init() {
        let http = SupabaseClient()
        let store = SessionStore()
        sessionStore = store
        auth = AuthRepository(http: http, store: store)
        sync = SyncRepository(http: http, sessions: store)
        whitelist = WhitelistStore()
        sessions = SessionManager(sync: sync)

        sessionStore.objectWillChange.sink { [weak self] _ in self?.objectWillChange.send() }.store(in: &bag)
        sync.objectWillChange.sink { [weak self] _ in self?.objectWillChange.send() }.store(in: &bag)
        whitelist.objectWillChange.sink { [weak self] _ in self?.objectWillChange.send() }.store(in: &bag)
        sessions.objectWillChange.sink { [weak self] _ in self?.objectWillChange.send() }.store(in: &bag)
    }

    func bootstrap() async {
        _ = await auth.refreshSession()
        if sessionStore.session != nil {
            await sync.syncNow()
        }
        if sessions.state.phase != .idle {
            sessions.startTimer()
        }
    }
}
