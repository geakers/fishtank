import Combine
import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

/// Focus Guard: during a session, Screen Time blocks every app and website except the ones the
/// user allowed. Needs the user's Screen Time permission, asked for once.
@MainActor
final class ScreenTimeLock: ObservableObject {
    @Published private(set) var authorized: Bool
    /// The apps and websites that stay open during a session. Whole categories can't be
    /// allowed, only the apps picked one by one.
    @Published var selection: FamilyActivitySelection {
        didSet { save() }
    }

    private let key = "focusflip_screen_time_selection"
    private var bag = Set<AnyCancellable>()

    init() {
        authorized = AuthorizationCenter.shared.authorizationStatus == .approved
        selection = UserDefaults.standard.data(forKey: key)
            .flatMap { try? JSONDecoder().decode(FamilyActivitySelection.self, from: $0) }
            ?? FamilyActivitySelection()
        // The permission can be taken away in Settings at any time.
        AuthorizationCenter.shared.$authorizationStatus
            .receive(on: DispatchQueue.main)
            .sink { [weak self] status in self?.authorized = status == .approved }
            .store(in: &bag)
    }

    /// How many apps and websites stay open during a session.
    var allowedCount: Int { selection.applicationTokens.count + selection.webDomainTokens.count }

    /// Asks for Screen Time permission. Returns whether FocusFlip has it.
    @discardableResult
    func requestAuthorization() async -> Bool {
        do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
        } catch {
            // Declining throws; the status below says how it went.
        }
        authorized = AuthorizationCenter.shared.authorizationStatus == .approved
        return authorized
    }

    /// Blocks everything but the allowed apps and websites until end. FocusFlipMonitor
    /// unblocks them at end even if FocusFlip isn't running then.
    func lock(until end: Date) {
        guard authorized else { return }
        FocusShield.store.shield.applicationCategories = .all(except: selection.applicationTokens)
        FocusShield.store.shield.webDomainCategories = .all(except: selection.webDomainTokens)
        scheduleUnblock(at: end)
    }

    func unlock() {
        DeviceActivityCenter().stopMonitoring([FocusShield.activity])
        FocusShield.unblock()
    }

    /// Schedules FocusFlipMonitor for end. A schedule must run at least 15 minutes, so a
    /// shorter session gets a 15-minute schedule whose end warning fires at end instead.
    private func scheduleUnblock(at end: Date, now: Date = Date()) {
        let center = DeviceActivityCenter()
        center.stopMonitoring([FocusShield.activity])
        // A minute over the minimum, so rounding never makes the schedule too short.
        let intervalEnd = max(end, now.addingTimeInterval(16 * 60))
        let early = Int(intervalEnd.timeIntervalSince(end).rounded())
        let parts: Set<Calendar.Component> = [.hour, .minute, .second]
        let schedule = DeviceActivitySchedule(
            intervalStart: Calendar.current.dateComponents(parts, from: now),
            intervalEnd: Calendar.current.dateComponents(parts, from: intervalEnd),
            repeats: false,
            warningTime: early > 0 ? DateComponents(minute: early / 60, second: early % 60) : nil
        )
        do {
            try center.startMonitoring(FocusShield.activity, during: schedule)
        } catch {
            // FocusFlip still unblocks everything itself when the session ends in the app.
            print("FocusFlip: couldn't schedule the unblock: \(error)")
        }
    }

    private func save() {
        if let data = try? JSONEncoder().encode(selection) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}
