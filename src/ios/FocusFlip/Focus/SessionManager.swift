import Combine
import Foundation
import SwiftUI
import UIKit

/// A focus session counts up from when it starts until the user ends it, like a desktop
/// lock-in. Ending it at any time saves the time focused; there is no penalty.
@MainActor
final class SessionManager: ObservableObject {
    @Published private(set) var state = SessionState()
    @Published var showBounceBack = false

    private let sync: SyncRepository
    private let defaults = UserDefaults.standard

    init(sync: SyncRepository) {
        self.sync = sync
        state = read()
        if state.phase != .idle {
            UIApplication.shared.isIdleTimerDisabled = true
        }
    }

    var isLocked: Bool { state.phase == .focus }

    func startFocus() {
        update(SessionState(phase: .focus, startedAt: Date().timeIntervalSince1970))
        UIApplication.shared.isIdleTimerDisabled = true
    }

    /// Ends the session and records the time it ran, to be added to the account.
    func stop() {
        if state.phase == .focus {
            sync.record(FocusRecord(
                id: UUID().uuidString,
                startedAt: state.startedAt,
                endedAt: Date().timeIntervalSince1970,
                plannedMinutes: 0,
                completed: true
            ))
        }
        update(SessionState())
        UIApplication.shared.isIdleTimerDisabled = false
        showBounceBack = false
    }

    func handleScene(_ phase: ScenePhase) {
        if phase == .background && isLocked {
            defaults.set(true, forKey: "left_during_lock")
        }
        if phase == .active {
            if isLocked && defaults.bool(forKey: "left_during_lock") {
                showBounceBack = true
            }
            defaults.set(false, forKey: "left_during_lock")
        }
    }

    func dismissBounceBack() {
        showBounceBack = false
    }

    private func update(_ s: SessionState) {
        defaults.set(s.phase.rawValue, forKey: "phase")
        defaults.set(s.startedAt, forKey: "started")
        state = s
    }

    private func read() -> SessionState {
        SessionState(
            phase: Phase(rawValue: defaults.string(forKey: "phase") ?? "") ?? .idle,
            startedAt: defaults.double(forKey: "started")
        )
    }
}
