package com.focusflip.app.focus

import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.content.ContextCompat

/**
 * Foreground service that keeps the process alive for the whole run and drives
 * [FocusSessionManager.tick] once per second.
 */
class FocusTimerService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var shownState: SessionState? = null

    private val ticker = object : Runnable {
        override fun run() {
            FocusSessionManager.tick()
            val state = FocusSessionManager.state.value
            if (state.phase == Phase.IDLE) {
                stopSelf()
                return
            }
            if (state != shownState) {
                shownState = state
                getSystemService(NotificationManager::class.java)
                    .notify(Notifications.SESSION_NOTIFICATION_ID, Notifications.session(this@FocusTimerService, state))
            }
            handler.postDelayed(this, 1_000L)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val state = FocusSessionManager.state.value
        val notification = Notifications.session(this, state)
        // startForeground must always be called after startForegroundService, even if we stop right away.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(Notifications.SESSION_NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(Notifications.SESSION_NOTIFICATION_ID, notification)
        }
        shownState = state
        if (state.phase == Phase.IDLE) {
            stopSelf()
            return START_NOT_STICKY
        }
        handler.removeCallbacks(ticker)
        handler.post(ticker)
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(ticker)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        fun start(context: Context) {
            runCatching {
                ContextCompat.startForegroundService(context, Intent(context, FocusTimerService::class.java))
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, FocusTimerService::class.java))
        }
    }
}
