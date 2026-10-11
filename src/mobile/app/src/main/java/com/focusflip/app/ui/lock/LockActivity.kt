package com.focusflip.app.ui.lock

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.addCallback
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.focusflip.app.data.apps.InstalledApps
import com.focusflip.app.di.ServiceLocator
import com.focusflip.app.focus.FocusGuardService
import com.focusflip.app.focus.FocusSessionManager
import com.focusflip.app.focus.KioskMode
import com.focusflip.app.focus.Phase
import com.focusflip.app.ui.MainActivity
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Full-screen flip phone shown for the whole run (focus + break).
 * During FOCUS the back button is swallowed and the guard / kiosk mode keeps this on top.
 */
class LockActivity : ComponentActivity() {

    private var tones: ToneGenerator? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        hideSystemBars()

        onBackPressedDispatcher.addCallback(this) {
            // Locked: ignore. On break the phone is free, so just step out of the way.
            if (FocusSessionManager.state.value.phase == Phase.BREAK) moveTaskToBack(true)
        }
        // Media stream so the hardware volume keys (and the silent/media slider)
        // control keypad tones. STREAM_DTMF is a hidden in-call slider on most phones.
        volumeControlStream = AudioManager.STREAM_MUSIC
        tones = runCatching { ToneGenerator(AudioManager.STREAM_MUSIC, ToneGenerator.MAX_VOLUME) }.getOrNull()

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                // Drive the clock from the UI too, in case the ROM throttles the service.
                launch {
                    while (true) {
                        FocusSessionManager.tick()
                        delay(1_000)
                    }
                }
                FocusSessionManager.state.collect { s ->
                    when (s.phase) {
                        Phase.FOCUS -> KioskMode.enter(this@LockActivity)
                        Phase.BREAK -> KioskMode.exit(this@LockActivity)
                        Phase.IDLE -> leave()
                    }
                }
            }
        }

        setContent {
            val state by FocusSessionManager.state.collectAsStateWithLifecycle()
            val whitelist by ServiceLocator.whitelistStore.packages.collectAsStateWithLifecycle()
            val apps = remember(whitelist) {
                whitelist
                    .filter { InstalledApps.isInstalled(this, it) }
                    .map { LockApp(it, InstalledApps.label(this, it)) }
                    .sortedBy { it.label.lowercase() }
            }
            FlipPhoneScreen(
                state = state,
                apps = apps,
                onLaunchApp = {
                    FocusGuardService.onWhitelistedAppLaunch()
                    InstalledApps.launch(this, it.packageName)
                },
                onChooseContinue = FocusSessionManager::setContinueAfterBreak,
                onDevUnlock = FocusSessionManager::stop,
                onKeyTone = ::playTone,
            )
        }
    }

    override fun onResume() {
        super.onResume()
        isShowing = true
        com.focusflip.app.focus.DebugTrace.log(this, "LockActivity resumed")
        hideSystemBars()
        FocusGuardService.onLockScreenShown()
        FocusSessionManager.ensureTimerRunning()
    }

    override fun onPause() {
        isShowing = false
        super.onPause()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    override fun onDestroy() {
        tones?.release()
        tones = null
        super.onDestroy()
    }

    private fun playTone(key: Char) {
        val tone = when (key) {
            in '0'..'9' -> ToneGenerator.TONE_DTMF_0 + (key - '0')
            '*' -> ToneGenerator.TONE_DTMF_S
            '#' -> ToneGenerator.TONE_DTMF_P
            else -> ToneGenerator.TONE_PROP_BEEP
        }
        tones?.startTone(tone, 90)
    }

    private fun hideSystemBars() {
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun leave() {
        KioskMode.exit(this)
        startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        finish()
    }

    companion object {
        /** True while the lock screen is the resumed activity. */
        var isShowing = false
            private set

        fun launch(context: Context) {
            val intent = Intent(context, LockActivity::class.java).addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
            )
            runCatching { context.startActivity(intent) }
                .onFailure { Log.w("FocusGuard", "could not show lock screen", it) }
        }
    }
}
