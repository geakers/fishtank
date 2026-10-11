package com.focusflip.app.focus

import android.accessibilityservice.AccessibilityService
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.inputmethod.InputMethodManager
import android.widget.FrameLayout
import android.widget.TextView
import androidx.core.content.res.ResourcesCompat
import com.focusflip.app.R
import com.focusflip.app.di.ServiceLocator
import com.focusflip.app.ui.lock.LockActivity
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * The "lock" itself. While a focus block is running, every time a window from a
 * non-whitelisted app comes to the front (home screen, recents, settings, other apps),
 * the guard covers it with a full-screen overlay and brings FocusFlip's lock screen back.
 *
 * The overlay matters on ROMs (and Android 15+) that silently drop background activity
 * starts: an accessibility overlay needs no extra permission, blocks the app underneath,
 * and while it is visible the system allows FocusFlip to start its own activity.
 * Tapping the overlay also returns to the lock screen.
 */
class FocusGuardService : AccessibilityService() {

    private val scope = MainScope()
    private val handler = Handler(Looper.getMainLooper())
    private var keyboardPackages: Set<String> = emptySet()
    private var overlay: View? = null
    private var lastBringBack = 0L
    private var lastPackage: String? = null

    override fun onServiceConnected() {
        instance = this
        DebugTrace.log(this, "connected")
        FocusSessionManager.ensureTimerRunning()
        keyboardPackages = runCatching {
            getSystemService(InputMethodManager::class.java)
                .enabledInputMethodList.map { it.packageName }.toSet()
        }.getOrDefault(emptySet())
        scope.launch {
            FocusSessionManager.state.collect {
                if (it.phase != Phase.FOCUS) {
                    hideOverlay()
                } else {
                    // A new block started (e.g. after a break) while another app is in front.
                    handler.postDelayed({
                        if (!LockActivity.isShowing) lastPackage?.let(::evaluate)
                    }, 1_000)
                }
            }
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return
        lastPackage = pkg
        DebugTrace.log(this, "event $pkg cls=${event.className} locked=${FocusSessionManager.isLocked} lockShowing=${LockActivity.isShowing} overlay=${overlay != null}")
        evaluate(pkg)
    }

    private fun evaluate(pkg: String) {
        if (!FocusSessionManager.isLocked) {
            hideOverlay()
            return
        }
        // Some launchers animate task switches through the home screen; ignore that briefly
        // after the lock screen opens a whitelisted app, then re-check what ended up in front.
        val graceLeft = transitionGraceUntil - SystemClock.elapsedRealtime()
        if (graceLeft > 0) {
            handler.removeCallbacks(recheck)
            handler.postDelayed(recheck, graceLeft + 50)
            return
        }
        // Our own windows (including the overlay itself) and the keyboard never trigger the lock.
        if (pkg == packageName || pkg in keyboardPackages) return
        if (pkg in ALWAYS_ALLOWED || ServiceLocator.whitelistStore.contains(pkg)) {
            hideOverlay()
            return
        }
        if (pkg == SYSTEM_UI) {
            // Notification shade / quick settings: close it instead of leaving the app.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val ok = performGlobalAction(GLOBAL_ACTION_DISMISS_NOTIFICATION_SHADE)
                DebugTrace.log(this, "dismiss shade -> $ok")
            }
            return
        }
        block()
    }

    private val recheck = Runnable { lastPackage?.let { if (!LockActivity.isShowing) evaluate(it) } }

    private fun block() {
        // A transient system window (e.g. vivo's gesture plugin) over the resumed lock screen.
        if (LockActivity.isShowing) return
        showOverlay()
        val now = SystemClock.elapsedRealtime()
        if (now - lastBringBack < 400) return
        lastBringBack = now
        // Give the overlay time to become visible so the activity start is allowed;
        // retry a few times because some ROMs drop the first attempt.
        for (delay in longArrayOf(150, 700, 1_500)) {
            handler.postDelayed({
                DebugTrace.log(this, "retry@$delay locked=${FocusSessionManager.isLocked} showing=${LockActivity.isShowing}")
                if (FocusSessionManager.isLocked && !LockActivity.isShowing) LockActivity.launch(this)
            }, delay)
        }
    }

    private fun showOverlay() {
        if (overlay != null) return
        val view = buildOverlayView()
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.OPAQUE,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) setFitInsetsTypes(0)
        }
        runCatching {
            getSystemService(WindowManager::class.java).addView(view, params)
            overlay = view
        }.onFailure { DebugTrace.log(this, "overlay add failed: $it") }
        DebugTrace.log(this, "overlay shown=${overlay != null}")
    }

    private fun hideOverlay() {
        val view = overlay ?: return
        overlay = null
        runCatching { getSystemService(WindowManager::class.java).removeView(view) }
    }

    /** Plain-View version of the flip phone LCD, so it works without an Activity. */
    private fun buildOverlayView(): View {
        val density = resources.displayMetrics.density
        val lcd = TextView(this).apply {
            text = "FOCUSFLIP\n\nPHONE LOCKED\n\nThis app is not on\nyour whitelist.\n\n[ TAP TO RETURN ]"
            // Selawik, like the rest of the app; the system's bold sans if it can't load.
            typeface = runCatching { ResourcesCompat.getFont(this@FocusGuardService, R.font.selawik_bold) }.getOrNull()
                ?: Typeface.DEFAULT_BOLD
            textSize = 20f
            gravity = Gravity.CENTER
            setTextColor(Color.parseColor("#053A5C"))
            val pad = (24 * density).toInt()
            setPadding(pad, pad, pad, pad)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#D2F5FF"))
                cornerRadius = 12 * density
                setStroke((6 * density).toInt(), Color.parseColor("#062A47"))
            }
        }
        return FrameLayout(this).apply {
            // The Wii-white backdrop the lock screen sits on, as on iOS.
            setBackgroundColor(Color.parseColor("#F7F9FB"))
            addView(
                lcd,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    Gravity.CENTER,
                ).apply { val m = (28 * density).toInt(); setMargins(m, 0, m, 0) },
            )
            isClickable = true
            setOnClickListener { LockActivity.launch(this@FocusGuardService) }
        }
    }

    override fun onInterrupt() = Unit

    override fun onUnbind(intent: Intent?): Boolean {
        teardown()
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        teardown()
        super.onDestroy()
    }

    private fun teardown() {
        DebugTrace.log(this, "teardown")
        if (instance === this) instance = null
        hideOverlay()
        handler.removeCallbacksAndMessages(null)
        scope.cancel()
    }

    companion object {
        private const val SYSTEM_UI = "com.android.systemui"

        /** System surfaces that must keep working (emergency calls, permission prompts, system dialogs). */
        private val ALWAYS_ALLOWED = setOf(
            "android",
            "com.android.phone",
            "com.android.server.telecom",
            "com.android.emergency",
            "com.google.android.permissioncontroller",
            "com.android.permissioncontroller",
            "com.android.packageinstaller",
        )

        private var instance: FocusGuardService? = null
        private var transitionGraceUntil = 0L

        /** Called by the lock screen once it is in front again. */
        fun onLockScreenShown() {
            instance?.hideOverlay()
        }

        /** Called right before the lock screen opens a whitelisted app. */
        fun onWhitelistedAppLaunch() {
            transitionGraceUntil = SystemClock.elapsedRealtime() + 1_500
        }

        fun isEnabled(context: Context): Boolean {
            val me = ComponentName(context, FocusGuardService::class.java)
            val enabled = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
            ) ?: return false
            return enabled.split(':').any {
                ComponentName.unflattenFromString(it) == me
            }
        }
    }
}
