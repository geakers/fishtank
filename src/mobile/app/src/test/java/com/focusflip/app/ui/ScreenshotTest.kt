package com.focusflip.app.ui

import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import com.focusflip.app.data.groups.GroupInvite
import com.focusflip.app.data.groups.StudyGroup
import com.focusflip.app.data.sync.SyncStatus
import com.focusflip.app.focus.Phase
import com.focusflip.app.focus.SessionState
import com.focusflip.app.ui.auth.AuthScreen
import com.focusflip.app.ui.home.HomeContent
import com.focusflip.app.ui.lock.FlipPhoneScreen
import com.focusflip.app.ui.lock.LockApp
import com.focusflip.app.ui.theme.FocusFlipTheme
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

    /** A session committed to [commitMinutes] that has [remainingMs] to go. */
    private fun focus(commitMinutes: Int, remainingMs: Long): SessionState {
        val now = System.currentTimeMillis()
        return SessionState(Phase.FOCUS, now + remainingMs - commitMinutes * 60_000L, commitMinutes)
    }

    @Test
    fun lockFocusApps() = paparazzi.snapshot {
        FocusFlipTheme { FlipPhoneScreen(focus(45, 31 * 60_000L + 12_000L), apps, {}, {}, {}) }
    }

    @Test
    fun auth() = paparazzi.snapshot { FocusFlipTheme { AuthScreen() } }

    @Test
    fun home() = paparazzi.snapshot {
        FocusFlipTheme {
            HomeContent(
                displayName = "Demo Student",
                sync = SyncStatus(
                    lastSyncAt = System.currentTimeMillis(),
                    todayFocusMinutes = 90,
                    todaySessions = 2,
                    accountFocusMs = 754 * 60_000L,
                    accountPoints = 45_240.0,
                ),
                whitelistCount = 4,
                guardLabel = "Off",
                guardOn = false,
                commitMinutes = 25,
                groups = listOf(StudyGroup(1, "Calc study hall", "me"), StudyGroup(2, "CS 225", "them")),
                invites = listOf(GroupInvite(3, "Bio review", "sam")),
                uid = "me",
                onFocus = {}, onOpenWhitelist = {}, onGuard = {}, onOpenGroups = {}, onProfile = {},
            )
        }
    }
}
