import DeviceActivity
import ManagedSettings

/// The Screen Time block on every app the user didn't allow. Shared by the app, which puts it
/// up when a session starts, and the FocusFlipMonitor extension, which takes it down when the
/// session's time is up even if FocusFlip isn't running.
enum FocusShield {
    static let store = ManagedSettingsStore(named: ManagedSettingsStore.Name("focus"))
    /// The schedule that wakes FocusFlipMonitor at the end of a session.
    static let activity = DeviceActivityName("focus")

    static func unblock() {
        store.clearAllSettings()
    }
}
