package com.focusflip.app.data.sync

import kotlinx.coroutines.flow.StateFlow

/** One finished (or aborted) focus block. This is what gets synced to the desktop app. */
data class FocusRecord(
    val id: String,
    val startedAt: Long,
    val endedAt: Long,
    val plannedMinutes: Int,
    val completed: Boolean,
    val synced: Boolean = false,
)

data class SyncStatus(
    val lastSyncAt: Long? = null,
    val pendingCount: Int = 0,
    val todayFocusMinutes: Int = 0,
    val todaySessions: Int = 0,
    /** Account-wide completed focus time from the shared Fishtank `profiles.focus_ms` column. */
    val accountFocusMs: Long = 0,
    val isSyncing: Boolean = false,
    val lastError: String? = null,
)

/**
 * Keeps phone and desktop data in sync.
 *
 * Records are always written locally first ([record]) and pushed by [syncNow], so the
 * app works offline. Implementations:
 *  - [MockSyncRepository]   pretends to upload (current default)
 *  - [RemoteSyncRepository] skeleton for the real API
 */
interface SyncRepository {
    val status: StateFlow<SyncStatus>
    fun record(record: FocusRecord)
    suspend fun syncNow()

    /** Whitelist is part of the user's settings, so it is mirrored to the backend too. */
    suspend fun pushWhitelist(packages: Set<String>)
}
