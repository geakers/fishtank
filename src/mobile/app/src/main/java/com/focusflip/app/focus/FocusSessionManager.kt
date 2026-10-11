package com.focusflip.app.focus

import android.content.Context
import android.content.SharedPreferences
import com.focusflip.app.data.sync.FocusRecord
import com.focusflip.app.data.sync.Points
import com.focusflip.app.di.ServiceLocator
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID

enum class Phase { IDLE, FOCUS }

data class SessionState(
    val phase: Phase = Phase.IDLE,
    val startedAt: Long = 0L,
    /**
     * How long the user committed to focusing for. The session ends by itself once it has
     * run this long, and only a session that does earns points.
     */
    val commitMinutes: Int = 0,
) {
    val endsAt: Long get() = startedAt + commitMinutes * 60_000L

    fun elapsedSeconds(now: Long = System.currentTimeMillis()): Int =
        if (phase == Phase.IDLE) 0 else ((now - startedAt) / 1000).coerceAtLeast(0L).toInt()

    fun remainingSeconds(now: Long = System.currentTimeMillis()): Int =
        if (phase == Phase.IDLE) 0 else ((endsAt - now + 999) / 1000).coerceAtLeast(0L).toInt()

    /** 0 at the start of the session, 1 once the commitment is up. */
    fun progress(now: Long = System.currentTimeMillis()): Float =
        if (commitMinutes > 0) (elapsedSeconds(now) / (commitMinutes * 60f)).coerceAtMost(1f) else 0f
}

/** How the last session ended, for the message on the home screen. */
data class FinishedSession(
    val startedAt: Long,
    val completed: Boolean,
    val commitMinutes: Int,
    val seconds: Int,
)

/**
 * Owns the focus session: IDLE -> FOCUS (locked, for the minutes the user committed to) -> IDLE.
 * The session ends by itself when the commitment is up, and only then earns points; ending it
 * early with END still saves the time focused, but earns nothing. Same rules as the iOS app
 * and the desktop.
 *
 * State is persisted with absolute timestamps, so it survives process death and reboots;
 * [tick] simply compares the clock against [SessionState.endsAt].
 */
object FocusSessionManager {

    private lateinit var app: Context
    private lateinit var prefs: SharedPreferences
    private val _state = MutableStateFlow(SessionState())
    val state: StateFlow<SessionState> = _state.asStateFlow()

    private val _finished = MutableStateFlow<FinishedSession?>(null)
    /** The session that just ended, until the home screen has shown how it went. */
    val finished: StateFlow<FinishedSession?> = _finished.asStateFlow()

    fun init(context: Context) {
        app = context.applicationContext
        prefs = app.getSharedPreferences("focusflip_focus", Context.MODE_PRIVATE)
        _state.value = read()
    }

    val isLocked: Boolean get() = _state.value.phase == Phase.FOCUS

    /** The minutes the user last committed to, offered first next time. */
    val lastCommitMinutes: Int
        get() = prefs.getInt("commit_minutes", 0).takeIf { it > 0 } ?: Points.DEFAULT_COMMIT_MINUTES

    fun startFocus(minutes: Int) {
        val commit = minutes.coerceIn(Points.MIN_COMMIT_MINUTES, Points.MAX_COMMIT_MINUTES)
        prefs.edit().putInt("commit_minutes", commit).apply()
        _finished.value = null
        update(SessionState(Phase.FOCUS, System.currentTimeMillis(), commit))
        FocusTimerService.start(app)
    }

    /** Restarts the countdown service if a session is active (e.g. after an update or a process kill). */
    fun ensureTimerRunning() {
        tick()
        if (_state.value.phase != Phase.IDLE) FocusTimerService.start(app)
    }

    /** Ends the session once its commitment is up. Called every second by the service and the lock screen. */
    @Synchronized
    fun tick(now: Long = System.currentTimeMillis()) {
        val s = _state.value
        if (s.phase == Phase.FOCUS && now >= s.endsAt) finish(s.endsAt, completed = true)
    }

    /** Ends the session before its commitment is up. The time focused is saved, without points. */
    @Synchronized
    fun endEarly() {
        val s = _state.value
        if (s.phase != Phase.FOCUS) return
        val now = System.currentTimeMillis()
        // A press that lands as the time runs out still counts as finishing.
        if (now >= s.endsAt) finish(s.endsAt, completed = true) else finish(now, completed = false)
    }

    fun dismissFinished() {
        _finished.value = null
    }

    private fun finish(endedAt: Long, completed: Boolean) {
        val s = _state.value
        ServiceLocator.syncRepository.record(
            FocusRecord(
                id = UUID.randomUUID().toString(),
                startedAt = s.startedAt,
                endedAt = endedAt,
                plannedMinutes = s.commitMinutes,
                completed = completed,
            )
        )
        _finished.value = FinishedSession(
            startedAt = s.startedAt,
            completed = completed,
            commitMinutes = s.commitMinutes,
            seconds = ((endedAt - s.startedAt) / 1000).coerceAtLeast(0L).toInt(),
        )
        update(SessionState())
        FocusTimerService.stop(app)
    }

    private fun update(s: SessionState) {
        prefs.edit()
            .putString("phase", s.phase.name)
            .putLong("started", s.startedAt)
            .putInt("session_commit_minutes", s.commitMinutes)
            .apply()
        _state.value = s
    }

    private fun read(): SessionState {
        // A break saved by the old 45/15 cycle is over as far as this version is concerned.
        val phase = runCatching { Phase.valueOf(prefs.getString("phase", null)!!) }.getOrDefault(Phase.IDLE)
        if (phase == Phase.IDLE) return SessionState()
        val commit = prefs.getInt("session_commit_minutes", 0)
        return SessionState(
            phase = phase,
            startedAt = prefs.getLong("started", 0L),
            // A focus block saved by the old cycle ran for 45 minutes.
            commitMinutes = if (commit > 0) commit else 45,
        )
    }
}
