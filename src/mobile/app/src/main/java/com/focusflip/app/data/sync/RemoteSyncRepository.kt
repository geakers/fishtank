package com.focusflip.app.data.sync

import com.focusflip.app.data.auth.SessionStore
import com.focusflip.app.data.supabase.SupabaseException
import com.focusflip.app.data.supabase.SupabaseHttp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.URLEncoder

/**
 * Writes completed focus time to the shared Fishtank `profiles` row
 * (`focus_ms`, milliseconds). Same project as fishtank/src/database.
 *
 * Each finished focus block is queued locally first, then added to the
 * account total so the phone works offline and retries on SYNC NOW.
 */
class RemoteSyncRepository(
    supabaseUrl: String,
    publishableKey: String,
    private val sessionStore: SessionStore,
    private val store: LocalRecordStore,
) : SyncRepository {

    private val http = SupabaseHttp(supabaseUrl, publishableKey)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _status = MutableStateFlow(store.buildStatus())
    override val status: StateFlow<SyncStatus> = _status.asStateFlow()

    override fun record(record: FocusRecord) {
        store.add(record)
        if (!record.completed) store.markSynced(setOf(record.id))
        _status.value = store.buildStatus()
        scope.launch { syncNow() }
    }

    override suspend fun syncNow() {
        _status.value = store.buildStatus(isSyncing = true)
        try {
            val token = sessionStore.session.value?.accessToken
                ?: throw SupabaseException(401, "Not logged in.")
            val uid = sessionStore.session.value?.user?.id
                ?: throw SupabaseException(401, "Not logged in.")

            val current = fetchFocusMs(uid, token)
            val pending = store.all().filter { it.completed && !it.synced }
            val added = pending.sumOf { (it.endedAt - it.startedAt).coerceAtLeast(0L) }
            val next = if (pending.isNotEmpty()) {
                writeFocusMs(uid, token, current + added)
            } else {
                current
            }
            store.accountFocusMs = next
            if (pending.isNotEmpty()) store.markSynced(pending.map { it.id }.toSet())
            store.lastSyncAt = System.currentTimeMillis()
            _status.value = store.buildStatus()
        } catch (e: SupabaseException) {
            _status.value = store.buildStatus(error = e.message)
        } catch (e: IOException) {
            _status.value = store.buildStatus(error = "Can't reach the server.")
        }
    }

    override suspend fun pushWhitelist(packages: Set<String>) {
        // Whitelist stays on-device until a settings column exists on profiles.
    }

    private fun fetchFocusMs(uid: String, token: String): Long {
        val query = "uid=eq.${enc(uid)}&select=focus_ms&limit=1"
        val array = JSONArray(http.get("/rest/v1/profiles?$query", token))
        if (array.length() == 0) return store.accountFocusMs
        return array.getJSONObject(0).optLong("focus_ms", 0L)
    }

    private fun writeFocusMs(uid: String, token: String, value: Long): Long {
        val query = "uid=eq.${enc(uid)}"
        val updated = http.patch("/rest/v1/profiles?$query", JSONObject().put("focus_ms", value), token)
        return if (updated.length() > 0) updated.getJSONObject(0).optLong("focus_ms", value) else value
    }

    private fun enc(value: String) = URLEncoder.encode(value, Charsets.UTF_8.name())
}
