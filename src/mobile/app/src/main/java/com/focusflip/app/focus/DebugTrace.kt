package com.focusflip.app.focus

import android.content.Context
import android.os.SystemClock
import com.focusflip.app.BuildConfig
import java.io.File

// TEMP diagnostics: some ROMs drop app logcat output.
object DebugTrace {
    fun log(context: Context, msg: String) {
        if (!BuildConfig.DEBUG) return
        runCatching { File(context.filesDir, "trace.txt").appendText("${SystemClock.elapsedRealtime()} $msg\n") }
    }
}
