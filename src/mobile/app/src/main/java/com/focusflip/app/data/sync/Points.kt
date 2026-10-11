package com.focusflip.app.data.sync

import kotlin.math.ceil

/**
 * Points rules, kept the same as src/desktop/profiles.js (and Config.swift on iOS) so a
 * minute studied on the phone is worth what it is on the desktop.
 */
object Points {
    /**
     * TESTING ONLY: while true, focus time earns one point per second. Set to false together
     * with TEST_POINT_PER_SECOND on the desktop for 1/60 point per minute.
     */
    const val TEST_POINT_PER_SECOND = true
    val POINTS_PER_MINUTE: Double = if (TEST_POINT_PER_SECOND) 60.0 else 1.0 / 60

    /** How long a user can commit to focusing for, in minutes. Kept the same as the desktop. */
    const val MIN_COMMIT_MINUTES = 1
    const val MAX_COMMIT_MINUTES = 240
    const val DEFAULT_COMMIT_MINUTES = 25
    val COMMIT_PRESETS = listOf(15, 25, 45, 60, 90)

    data class Earnings(val minutes: Int, val points: Double)

    /**
     * What a focus time of this many seconds is worth. In test mode each second is a point and
     * a part minute counts as a whole one, so the points never outrun what the points check allows.
     */
    fun earnings(seconds: Long): Earnings {
        if (TEST_POINT_PER_SECOND) return Earnings(ceil(seconds / 60.0).toInt(), seconds.toDouble())
        val minutes = (seconds / 60).toInt()
        return Earnings(minutes, minutes * POINTS_PER_MINUTE)
    }

    /**
     * What a finished session adds to the account, like sessionEarnings on the desktop: every
     * session adds the minutes it ran, but only one that lasted its full commitment earns
     * points, and then for exactly the time committed to.
     */
    fun earnings(record: FocusRecord): Earnings {
        val ran = ((record.endedAt - record.startedAt) / 1000).coerceAtLeast(0L)
        if (!record.completed) return Earnings(earnings(ran).minutes, 0.0)
        // Sessions from before commitments (plannedMinutes 0) earn for the time they ran.
        return earnings(if (record.plannedMinutes > 0) record.plannedMinutes * 60L else ran)
    }
}
