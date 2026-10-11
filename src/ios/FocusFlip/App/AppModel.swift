import Combine
import SwiftUI

/// Wires the same pieces as Android ServiceLocator and forwards nested publishers.
@MainActor
final class AppModel: ObservableObject {
    let sessionStore: SessionStore
    let auth: AuthRepository
    let sync: SyncRepository
    let groups: GroupsRepository
    let whitelist: WhitelistStore
    let screenTime: ScreenTimeLock
    let sessions: SessionManager
    let tones = TonePlayer()

    private var bag = Set<AnyCancellable>()

    init() {
        let http = SupabaseClient()
        let store = SessionStore()
        sessionStore = store
        auth = AuthRepository(http: http, store: store)
        sync = SyncRepository(http: http, auth: auth)
        groups = GroupsRepository(http: http, auth: auth)
        whitelist = WhitelistStore()
        screenTime = ScreenTimeLock()
        sessions = SessionManager(sync: sync, screenTime: screenTime)

        sessionStore.objectWillChange.sink { [weak self] _ in self?.objectWillChange.send() }.store(in: &bag)
        sync.objectWillChange.sink { [weak self] _ in self?.objectWillChange.send() }.store(in: &bag)
        whitelist.objectWillChange.sink { [weak self] _ in self?.objectWillChange.send() }.store(in: &bag)
        screenTime.objectWillChange.sink { [weak self] _ in self?.objectWillChange.send() }.store(in: &bag)
        sessions.objectWillChange.sink { [weak self] _ in self?.objectWillChange.send() }.store(in: &bag)
    }

    func logOut() async {
        await auth.logout()
        sync.clearAccount()
    }

    func bootstrap() async {
        _ = await auth.refreshSession()
        if sessionStore.session != nil {
            await sync.syncNow()
        }
    }
}
