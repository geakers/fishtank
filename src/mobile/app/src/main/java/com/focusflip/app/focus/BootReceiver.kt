package com.focusflip.app.focus

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Resumes a running focus session's countdown after the phone restarts. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        FocusSessionManager.tick()
        if (FocusSessionManager.state.value.phase != Phase.IDLE) {
            FocusTimerService.start(context)
        }
    }
}
