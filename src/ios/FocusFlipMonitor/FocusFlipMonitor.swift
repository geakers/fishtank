import DeviceActivity
import ManagedSettings

/// Woken by the system at the end of a focus session (see ScreenTimeLock.lock) to unblock every
/// app, so the phone never stays locked if FocusFlip was closed or can't be opened.
final class FocusFlipMonitor: DeviceActivityMonitor {
    /// Sessions shorter than the system's 15-minute minimum schedule end on this warning.
    override func intervalWillEndWarning(for activity: DeviceActivityName) {
        super.intervalWillEndWarning(for: activity)
        if activity == FocusShield.activity { FocusShield.unblock() }
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        if activity == FocusShield.activity { FocusShield.unblock() }
    }
}
