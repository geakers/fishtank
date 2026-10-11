package com.focusflip.app.data.sync

import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * MOCK BACKEND - replace with [RemoteSyncRepository] when the real API is ready.
 * Simulates a network round-trip and marks every pending record as synced.
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
        val pending = store.all().filter { !it.synced }.map { it.id }.toSet()
        store.markSynced(pending)
        store.lastSyncAt = System.currentTimeMillis()
        _status.value = store.buildStatus()
    }

    override suspend fun pushWhitelist(packages: Set<String>) {
        // Mock: nothing to upload. The real implementation sends PUT settings/whitelist.
    }
}
