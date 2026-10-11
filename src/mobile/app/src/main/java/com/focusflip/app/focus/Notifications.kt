package com.focusflip.app.focus

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.focusflip.app.R
import com.focusflip.app.ui.lock.LockActivity

object Notifications {

    private const val CHANNEL_ID = "focus_session"
    const val SESSION_NOTIFICATION_ID = 45

    fun createChannel(context: Context) {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Focus session",
            NotificationManager.IMPORTANCE_LOW,
        ).apply { description = "Shows the time left in a focus session." }
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    fun session(context: Context, state: SessionState): Notification {
        val open = PendingIntent.getActivity(
            context,
            0,
            Intent(context, LockActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val (title, text) = when (state.phase) {
            Phase.FOCUS -> "${state.commitMinutes}-minute focus - phone locked" to
                "Stay until the end to earn your points. Study apps only."
            Phase.IDLE -> "FocusFlip" to "No active session."
        }
        return Notification.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(open)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(true)
            .setWhen(state.endsAt)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .build()
    }
}
