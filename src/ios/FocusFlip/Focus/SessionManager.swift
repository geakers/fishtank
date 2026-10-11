import Combine
import Foundation
import SwiftUI
import UIKit

final class SessionManager: ObservableObject {
    @Published private(set) var state = SessionState()
    @Published var fastMode: Bool {
        didSet { UserDefaults.standard.set(fastMode, forKey: "fast_mode") }
    }
    @Published var showBounceBack = false

    private let sync: SyncRepository
    private var timer: Timer?
    private let defaults = UserDefaults.standard

    init(sync: SyncRepository) {
        self.sync = sync
        self.fastMode = defaults.bool(forKey: "fast_mode")
        state = read()
        if state.phase != .idle {
            UIApplication.shared.isIdleTimerDisabled = true
            startTimer()
        }
    }

    var isLocked: Bool { state.phase == .focus }

    private var focusMs: TimeInterval { fastMode ? Double(Config.fastFocusMs) / 1000 : Double(Config.focusMinutes * 60) }
    private var breakMs: TimeInterval { fastMode ? Double(Config.fastBreakMs) / 1000 : Double(Config.breakMinutes * 60) }

    func startFocus() {
        let now = Date().timeIntervalSince1970
        update(SessionState(phase: .focus, phaseStartedAt: now, phaseEndsAt: now + focusMs, continueAfterBreak: true, cycle: 1))
        UIApplication.shared.isIdleTimerDisabled = true
        startTimer()
    }

    func setContinueAfterBreak(_ value: Bool) {
        guard state.phase == .breakTime else { return }
        update(SessionState(phase: state.phase, phaseStartedAt: state.phaseStartedAt, phaseEndsAt: state.phaseEndsAt, continueAfterBreak: value, cycle: state.cycle))
    }

    func stop() {
        if state.phase == .focus {
            recordFocus(state, endedAt: Date().timeIntervalSince1970, completed: false)
        }
        update(SessionState())
        UIApplication.shared.isIdleTimerDisabled = false
        showBounceBack = false
        timer?.invalidate()
        timer = nil
    }

    func tick(now: Date = Date()) {
        var s = state
        var enteredFocus = false
        let t = now.timeIntervalSince1970
        while s.phase != .idle && t >= s.phaseEndsAt {
            switch s.phase {
            case .focus:
                recordFocus(s, endedAt: s.phaseEndsAt, completed: true)
                s = SessionState(phase: .breakTime, phaseStartedAt: s.phaseEndsAt, phaseEndsAt: s.phaseEndsAt + breakMs, continueAfterBreak: s.continueAfterBreak, cycle: s.cycle)
            case .breakTime:
                if s.continueAfterBreak {
                    enteredFocus = true
                    s = SessionState(phase: .focus, phaseStartedAt: s.phaseEndsAt, phaseEndsAt: s.phaseEndsAt + focusMs, continueAfterBreak: true, cycle: s.cycle + 1)
                } else {
                    s = SessionState()
                }
            case .idle:
                break
            }
        }
        if s != state { update(s) }
        if enteredFocus && s.phase == .focus { showBounceBack = false }
        if s.phase == .idle {
            UIApplication.shared.isIdleTimerDisabled = false
            timer?.invalidate()
            timer = nil
        }
    }

    func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.tick()
        }
        RunLoop.main.add(timer!, forMode: .common)
    }

    func handleScene(_ phase: ScenePhase) {
        tick()
        if phase == .background && isLocked {
            defaults.set(true, forKey: "left_during_lock")
        }
        if phase == .active {
            if isLocked && defaults.bool(forKey: "left_during_lock") {
                showBounceBack = true
            }
            defaults.set(false, forKey: "left_during_lock")
            if state.phase != .idle { startTimer() }
        }
    }

    func dismissBounceBack() {
        showBounceBack = false
    }

    private func recordFocus(_ s: SessionState, endedAt: TimeInterval, completed: Bool) {
        sync.record(FocusRecord(
            id: UUID().uuidString,
            startedAt: s.phaseStartedAt,
            endedAt: endedAt,
            plannedMinutes: Int(s.phaseDurationMs / 60_000),
            completed: completed
        ))
    }

    private func update(_ s: SessionState) {
        defaults.set(s.phase.rawValue, forKey: "phase")
        defaults.set(s.phaseStartedAt, forKey: "started")
        defaults.set(s.phaseEndsAt, forKey: "ends")
        defaults.set(s.continueAfterBreak, forKey: "continue")
        defaults.set(s.cycle, forKey: "cycle")
        state = s
    }

    private func read() -> SessionState {
        SessionState(
            phase: Phase(rawValue: defaults.string(forKey: "phase") ?? "") ?? .idle,
            phaseStartedAt: defaults.double(forKey: "started"),
            phaseEndsAt: defaults.double(forKey: "ends"),
            continueAfterBreak: defaults.object(forKey: "continue") as? Bool ?? true,
            cycle: defaults.integer(forKey: "cycle")
        )
    }
}
