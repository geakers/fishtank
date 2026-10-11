package com.focusflip.app.focus

import android.content.Context
import android.content.SharedPreferences
import com.focusflip.app.data.sync.FocusRecord
import com.focusflip.app.di.ServiceLocator
import com.focusflip.app.ui.lock.LockActivity
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID

enum class Phase { IDLE, FOCUS, BREAK }

data class SessionState(
    val phase: Phase = Phase.IDLE,
    val phaseStartedAt: Long = 0L,
    val phaseEndsAt: Long = 0L,
    /** Chosen on the break screen: start another focus block, or finish when the break ends. */
    val continueAfterBreak: Boolean = true,
    /** 1-based number of the current focus block within this run. */
    val cycle: Int = 0,
) {
    val phaseDurationMs: Long get() = phaseEndsAt - phaseStartedAt
    fun remainingMs(now: Long = System.currentTimeMillis()) = (phaseEndsAt - now).coerceAtLeast(0L)
}

/**
 * Owns the focus/break cycle: IDLE -> FOCUS (45 min, locked) -> BREAK (15 min, free)
 * -> FOCUS again or IDLE, depending on the user's choice during the break.
 *
 * State is persisted with absolute timestamps, so it survives process death and reboots;
 * [tick] simply compares the clock against [SessionState.phaseEndsAt].
 */
object FocusSessionManager {

    private const val FOCUS_MINUTES = 45
    private const val BREAK_MINUTES = 15
    private const val FAST_FOCUS_MS = 45_000L
    private const val FAST_BREAK_MS = 15_000L

    private lateinit var app: Context
    private lateinit var prefs: SharedPreferences
    private val _state = MutableStateFlow(SessionState())
    val state: StateFlow<SessionState> = _state.asStateFlow()

    /** Developer option: 45 s focus / 15 s break so the whole cycle can be tested quickly. */
    var fastMode: Boolean
        get() = prefs.getBoolean("fast_mode", false)
        set(value) { prefs.edit().putBoolean("fast_mode", value).apply() }

    private val focusMs get() = if (fastMode) FAST_FOCUS_MS else FOCUS_MINUTES * 60_000L
    private val breakMs get() = if (fastMode) FAST_BREAK_MS else BREAK_MINUTES * 60_000L

    fun init(context: Context) {
        app = context.applicationContext
        prefs = app.getSharedPreferences("focusflip_focus", Context.MODE_PRIVATE)
        _state.value = read()
    }

    val isLocked: Boolean get() = _state.value.phase == Phase.FOCUS

    fun startFocus() {
        val now = System.currentTimeMillis()
        update(SessionState(Phase.FOCUS, now, now + focusMs, continueAfterBreak = true, cycle = 1))
        FocusTimerService.start(app)
    }

    /** Restarts the countdown service if a session is active (e.g. after an update or a process kill). */
    fun ensureTimerRunning() {
        tick()
        if (_state.value.phase != Phase.IDLE) FocusTimerService.start(app)
    }

    fun setContinueAfterBreak(value: Boolean) {
        val s = _state.value
        if (s.phase == Phase.BREAK) update(s.copy(continueAfterBreak = value))
    }

    /** Advances the state machine if the current phase is over. Called every second by the service. */
    @Synchronized
    fun tick(now: Long = System.currentTimeMillis()) {
        var s = _state.value
        var enteredFocus = false
        // Loop in case the device slept through more than one phase boundary.
        while (s.phase != Phase.IDLE && now >= s.phaseEndsAt) {
            s = when (s.phase) {
                Phase.FOCUS -> {
                    recordFocus(s, s.phaseEndsAt, completed = true)
                    SessionState(Phase.BREAK, s.phaseEndsAt, s.phaseEndsAt + breakMs, s.continueAfterBreak, s.cycle)
                }
                Phase.BREAK -> if (s.continueAfterBreak) {
                    enteredFocus = true
                    SessionState(Phase.FOCUS, s.phaseEndsAt, s.phaseEndsAt + focusMs, true, s.cycle + 1)
                } else {
                    SessionState()
                }
                Phase.IDLE -> s
            }
        }
        if (s != _state.value) update(s)
        if (enteredFocus && s.phase == Phase.FOCUS) LockActivity.launch(app)
    }

    /** Ends everything immediately (developer unlock button, or "exit" at the end of a break). */
    @Synchronized
    fun stop() {
        val s = _state.value
        if (s.phase == Phase.FOCUS) recordFocus(s, System.currentTimeMillis(), completed = false)
        update(SessionState())
        FocusTimerService.stop(app)
    }

    private fun recordFocus(s: SessionState, endedAt: Long, completed: Boolean) {
        ServiceLocator.syncRepository.record(
            FocusRecord(
                id = UUID.randomUUID().toString(),
                startedAt = s.phaseStartedAt,
                endedAt = endedAt,
                plannedMinutes = (s.phaseDurationMs / 60_000L).toInt(),
                completed = completed,
            )
        )
    }

    private fun update(s: SessionState) {
        prefs.edit()
            .putString("phase", s.phase.name)
            .putLong("started", s.phaseStartedAt)
            .putLong("ends", s.phaseEndsAt)
            .putBoolean("continue", s.continueAfterBreak)
            .putInt("cycle", s.cycle)
            .apply()
        _state.value = s
    }

    private fun read() = SessionState(
        phase = runCatching { Phase.valueOf(prefs.getString("phase", null)!!) }.getOrDefault(Phase.IDLE),
        phaseStartedAt = prefs.getLong("started", 0L),
        phaseEndsAt = prefs.getLong("ends", 0L),
        continueAfterBreak = prefs.getBoolean("continue", true),
        cycle = prefs.getInt("cycle", 0),
    )
}
