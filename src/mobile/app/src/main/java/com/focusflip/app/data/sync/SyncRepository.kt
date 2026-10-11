package com.focusflip.app.data.sync

import kotlinx.coroutines.flow.StateFlow

/** One finished focus session. This is what gets added to the account. */
data class FocusRecord(
    val id: String,
    val startedAt: Long,
    val endedAt: Long,
    /** The minutes the user committed to. */
    val plannedMinutes: Int,
    /** true when the session lasted the full commitment, which is what earns points. */
    val completed: Boolean,
    val synced: Boolean = false,
)

data class SyncStatus(
    val lastSyncAt: Long? = null,
    val pendingCount: Int = 0,
    val todayFocusMinutes: Int = 0,
    /** Sessions today that lasted their full commitment. */
    val todaySessions: Int = 0,
    /** Account-wide study time, from the shared Fishtank `profiles.minutes_studied` column. */
    val accountFocusMs: Long = 0,
    /** The account's points, from `profiles.points`. */
    val accountPoints: Double = 0.0,
    /** The username on the account's profile, once a sync has read it. */
    val username: String? = null,
    /** false when the points are more than the minutes studied can account for. */
    val pointsValid: Boolean = true,
    val isSyncing: Boolean = false,
    val lastError: String? = null,
)

/**
 * Keeps phone and desktop data in sync.
 *
 * Records are always written locally first ([record]) and added to the account by
 * [syncNow], so the app works offline. Implementations:
 *  - [RemoteSyncRepository] the shared Fishtank Supabase project (default)
 *  - [MockSyncRepository]   pretends to upload (USE_MOCK_BACKEND = true)
 */
interface SyncRepository {
    val status: StateFlow<SyncStatus>
    fun record(record: FocusRecord)
    suspend fun syncNow()

    /** Forgets the cached account so the next user doesn't see it. Unsynced records stay. */
    fun clearAccount()
}
