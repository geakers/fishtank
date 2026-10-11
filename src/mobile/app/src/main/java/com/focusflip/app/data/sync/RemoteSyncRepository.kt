package com.focusflip.app.data.sync

import com.focusflip.app.data.auth.AuthRepository
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
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.URLEncoder
import kotlin.math.roundToLong

/**
 * Adds finished focus sessions to the shared Fishtank `profiles` row (`minutes_studied` and
 * `points`), the same columns the desktop and iOS apps use, and mirrors the row's username,
 * points and study time for the home screen.
 *
 * Each session is queued on the device first, then added to the account, so the phone
 * works offline and retries on the next sync.
 */
class RemoteSyncRepository(
    supabaseUrl: String,
    publishableKey: String,
    private val sessionStore: SessionStore,
    private val auth: AuthRepository,
    private val store: LocalRecordStore,
) : SyncRepository {

    private val http = SupabaseHttp(supabaseUrl, publishableKey)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    /** One sync at a time, so two never add the same records to the account twice. */
    private val running = Mutex()
    private val _status = MutableStateFlow(store.buildStatus())
    override val status: StateFlow<SyncStatus> = _status.asStateFlow()

    override fun record(record: FocusRecord) {
        store.add(record)
        _status.value = store.buildStatus()
        scope.launch { syncNow() }
    }

    override suspend fun syncNow() {
        running.withLock { sync() }
    }

    private suspend fun sync() {
        _status.value = store.buildStatus(isSyncing = true)
        try {
            auth.refreshSession()
            val session = sessionStore.session.value ?: throw SupabaseException(401, "Not logged in.")
            val uid = session.user.id
            val token = session.accessToken
            withContext(Dispatchers.IO) {
                var profile = fetchProfile(uid, token)
                val pending = store.all().filter { !it.synced }
                // Every session adds the time it ran; only finished commitments add points.
                val earned = pending.map { Points.earnings(it) }
                val addedMinutes = earned.sumOf { it.minutes }
                val pointsDelta = earned.sumOf { it.points }

                if (addedMinutes > 0 || pointsDelta != 0.0) {
                    // One PATCH, so minutes and points are saved together or not at all.
                    // Rounded so repeated additions don't pick up floating point noise.
                    val points = ((profile.points + pointsDelta) * 10_000).roundToLong() / 10_000.0
                    profile = writeProfile(uid, token, profile.minutes + addedMinutes, points)
                }
                if (pending.isNotEmpty()) store.markSynced(pending.map { it.id }.toSet())
                store.accountFocusMs = profile.minutes * 60_000L
                store.accountPoints = profile.points
                profile.username?.let { store.username = it }
                // Same check as verifyPoints on the desktop: points can't outrun study time.
                store.pointsValid = profile.points <= profile.minutes * Points.POINTS_PER_MINUTE + 0.01
                store.lastSyncAt = System.currentTimeMillis()
            }
            _status.value = store.buildStatus()
        } catch (e: SupabaseException) {
            _status.value = store.buildStatus(error = e.message)
        } catch (e: IOException) {
            _status.value = store.buildStatus(error = "Can't reach the server.")
        } catch (e: org.json.JSONException) {
            _status.value = store.buildStatus(error = "Unexpected reply from the server.")
        }
    }

    override fun clearAccount() {
        store.clearAccount()
        _status.value = store.buildStatus()
    }

    private data class Profile(val username: String?, val minutes: Int, val points: Double)

    private fun fetchProfile(uid: String, token: String): Profile {
        val rows = JSONArray(http.get("/rest/v1/profiles?uid=eq.${enc(uid)}&select=$COLUMNS&limit=1", token))
        if (rows.length() == 0) throw SupabaseException(404, "No profile found.")
        return profile(rows.getJSONObject(0))
    }

    private fun writeProfile(uid: String, token: String, minutes: Int, points: Double): Profile {
        val body = JSONObject().put("minutes_studied", minutes).put("points", points)
        val rows = http.patch("/rest/v1/profiles?uid=eq.${enc(uid)}&select=$COLUMNS", body, token)
        // No row back means row level security refused the change.
        if (rows.length() == 0) throw SupabaseException(403, "No profile was updated.")
        return profile(rows.getJSONObject(0))
    }

    private fun profile(row: JSONObject) = Profile(
        username = row.optString("username").ifBlank { null },
        minutes = row.optInt("minutes_studied", 0),
        points = row.optDouble("points", 0.0),
    )

    private fun enc(value: String) = URLEncoder.encode(value, Charsets.UTF_8.name())

    private companion object {
        const val COLUMNS = "username,minutes_studied,points"
    }
}
