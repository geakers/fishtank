import Combine
import Foundation
import SwiftUI
import UIKit

/// A focus session runs for the minutes the user committed to, then ends by itself. Only a
/// session that lasts its full commitment earns points; ending it early with END still saves
/// the time focused, but earns nothing. While a session runs, Focus Guard
/// (ScreenTimeLock) blocks every app the user didn't allow.
@MainActor
final class SessionManager: ObservableObject {
    @Published private(set) var state = SessionState()
    @Published var showBounceBack = false
    /// The session that just ended, until the home screen has shown how it went.
    @Published var finished: FinishedSession?

    private let sync: SyncRepository
    private let screenTime: ScreenTimeLock
    private let defaults = UserDefaults.standard

    init(sync: SyncRepository, screenTime: ScreenTimeLock) {
        self.sync = sync
        self.screenTime = screenTime
        state = read()
        if state.phase != .idle {
            UIApplication.shared.isIdleTimerDisabled = true
        } else {
            // Never leave apps blocked with no session running.
            screenTime.unlock()
        }
        // The commitment may have run out while the app was closed.
        tick()
    }

    var isLocked: Bool { state.phase == .focus }

    /// The minutes the user last committed to, offered first next time.
    var lastCommitMinutes: Int {
        let saved = defaults.integer(forKey: "commit_minutes")
        return saved > 0 ? saved : Config.defaultCommitMinutes
    }

    func startFocus(minutes: Int) {
        let minutes = min(max(minutes, Config.minCommitMinutes), Config.maxCommitMinutes)
        defaults.set(minutes, forKey: "commit_minutes")
        finished = nil
        update(SessionState(phase: .focus, startedAt: Date().timeIntervalSince1970, commitMinutes: minutes))
        screenTime.lock(until: Date(timeIntervalSince1970: state.endsAt))
        UIApplication.shared.isIdleTimerDisabled = true
    }

    /// Ends the session once its commitment is up. Called every second by the lock screen
    /// and whenever the app comes back to the front.
    func tick(now: Date = Date()) {
        guard state.phase == .focus, now.timeIntervalSince1970 >= state.endsAt else { return }
        finish(endedAt: state.endsAt, completed: true)
    }

    /// Ends the session before its commitment is up. The time focused is saved, without points.
    func endEarly() {
        guard state.phase == .focus else { return }
        let now = Date().timeIntervalSince1970
        // A press that lands as the time runs out still counts as finishing.
        if now >= state.endsAt {
            finish(endedAt: state.endsAt, completed: true)
        } else {
            finish(endedAt: now, completed: false)
        }
    }

    private func finish(endedAt: TimeInterval, completed: Bool) {
        let s = state
        sync.record(FocusRecord(
            id: UUID().uuidString,
            startedAt: s.startedAt,
            endedAt: endedAt,
            plannedMinutes: s.commitMinutes,
            completed: completed
        ))
        finished = FinishedSession(
            startedAt: s.startedAt,
            completed: completed,
            commitMinutes: s.commitMinutes,
            seconds: Int(max(0, endedAt - s.startedAt))
        )
        update(SessionState())
        screenTime.unlock()
        UIApplication.shared.isIdleTimerDisabled = false
        showBounceBack = false
    }

    func handleScene(_ phase: ScenePhase) {
        if phase == .background && isLocked {
            defaults.set(true, forKey: "left_during_lock")
        }
        if phase == .active {
            tick()
            // With Focus Guard on, leaving for an allowed app is fine: Screen Time blocks the rest.
            if isLocked && !screenTime.authorized && defaults.bool(forKey: "left_during_lock") {
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
        defaults.set(s.commitMinutes, forKey: "session_commit_minutes")
        state = s
    }

    private func read() -> SessionState {
        var s = SessionState(
            phase: Phase(rawValue: defaults.string(forKey: "phase") ?? "") ?? .idle,
            startedAt: defaults.double(forKey: "started"),
            commitMinutes: defaults.integer(forKey: "session_commit_minutes")
        )
        // A session saved by the count-up version has no commitment; give it the default so
        // it still ends by itself.
        if s.phase == .focus && s.commitMinutes == 0 { s.commitMinutes = Config.defaultCommitMinutes }
        return s
    }
}
