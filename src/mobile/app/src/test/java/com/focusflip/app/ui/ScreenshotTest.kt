package com.focusflip.app.ui

import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import com.focusflip.app.data.sync.SyncStatus
import com.focusflip.app.focus.Phase
import com.focusflip.app.ui.home.HomeContent
import com.focusflip.app.focus.SessionState
import com.focusflip.app.ui.auth.AuthScreen
import com.focusflip.app.ui.lock.FlipPhoneScreen
import com.focusflip.app.ui.lock.LockApp
import org.junit.Rule
import org.junit.Test

class ScreenshotTest {

    @get:Rule
    val paparazzi = Paparazzi(deviceConfig = DeviceConfig.PIXEL_6)

    private val apps = listOf(
        LockApp("com.android.deskclock", "Clock"),
        LockApp("com.google.android.calculator", "Calculator"),
        LockApp("com.google.android.keep", "Keep Notes"),
        LockApp("com.spotify.music", "Spotify"),
    )

    private fun state(phase: Phase, remainingMs: Long, totalMs: Long, continueAfterBreak: Boolean = true): SessionState {
        val now = System.currentTimeMillis()
        return SessionState(phase, now + remainingMs - totalMs, now + remainingMs, continueAfterBreak, cycle = 1)
    }

    @Test
    fun lockFocusApps() = paparazzi.snapshot {
        FlipPhoneScreen(state(Phase.FOCUS, 31 * 60_000L + 12_000L, 45 * 60_000L), apps, {}, {}, {}, {})
    }

    @Test
    fun lockBreak() = paparazzi.snapshot {
        FlipPhoneScreen(state(Phase.BREAK, 9 * 60_000L, 15 * 60_000L), apps, {}, {}, {}, {})
    }

    @Test
    fun auth() = paparazzi.snapshot { AuthScreen() }

    @Test
    fun home() = paparazzi.snapshot {
        HomeContent(
            displayName = "Demo Student",
            sync = SyncStatus(lastSyncAt = System.currentTimeMillis(), pendingCount = 1, todayFocusMinutes = 90, todaySessions = 2),
            whitelistCount = 4,
            guardOn = false,
            deviceOwner = false,
            fastMode = false,
            onStartLock = {}, onOpenWhitelist = {}, onEnableGuard = {}, onSyncNow = {},
            onLogout = {}, onFastModeChange = {}, onReleaseDeviceOwner = {},
        )
    }
}
