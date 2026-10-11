package com.focusflip.app.data.sync

import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * MOCK BACKEND for working offline (USE_MOCK_BACKEND = true). Simulates a network round-trip
 * and adds every pending record to a pretend account on the device, by the real points rules.
 */
class MockSyncRepository(private val store: LocalRecordStore) : SyncRepository {

    private val _status = MutableStateFlow(store.buildStatus())
    override val status: StateFlow<SyncStatus> = _status.asStateFlow()

    override fun record(record: FocusRecord) {
        store.add(record)
        _status.value = store.buildStatus()
    }

    override suspend fun syncNow() {
        _status.value = store.buildStatus(isSyncing = true)
        delay(900)
        val pending = store.all().filter { !it.synced }
        val earned = pending.map { Points.earnings(it) }
        store.accountFocusMs += earned.sumOf { it.minutes } * 60_000L
        store.accountPoints += earned.sumOf { it.points }
        store.markSynced(pending.map { it.id }.toSet())
        store.lastSyncAt = System.currentTimeMillis()
        _status.value = store.buildStatus()
    }

    override fun clearAccount() {
        store.clearAccount()
        _status.value = store.buildStatus()
    }
}
