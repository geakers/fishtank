package com.focusflip.app.data.sync

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/** On-device queue of focus records. Shared by the mock and the real sync repository. */
class LocalRecordStore(context: Context) {

    private val prefs = context.getSharedPreferences("focusflip_records", Context.MODE_PRIVATE)

    @Synchronized
    fun all(): List<FocusRecord> {
        val array = JSONArray(prefs.getString(KEY_RECORDS, "[]"))
        return (0 until array.length()).map { i ->
            val o = array.getJSONObject(i)
            FocusRecord(
                id = o.getString("id"),
                startedAt = o.getLong("startedAt"),
                endedAt = o.getLong("endedAt"),
                plannedMinutes = o.getInt("plannedMinutes"),
                completed = o.getBoolean("completed"),
                synced = o.optBoolean("synced", false),
            )
        }
    }

    @Synchronized
    fun add(record: FocusRecord) = write(all() + record)

    @Synchronized
    fun markSynced(ids: Set<String>) =
        write(all().map { if (it.id in ids) it.copy(synced = true) else it })

    var lastSyncAt: Long?
        get() = prefs.getLong(KEY_LAST_SYNC, -1L).takeIf { it > 0 }
        set(value) { prefs.edit().putLong(KEY_LAST_SYNC, value ?: -1L).apply() }

    var accountFocusMs: Long
        get() = prefs.getLong(KEY_ACCOUNT_MS, 0L)
        set(value) { prefs.edit().putLong(KEY_ACCOUNT_MS, value).apply() }

    var accountPoints: Double
        get() = Double.fromBits(prefs.getLong(KEY_ACCOUNT_POINTS, 0.0.toRawBits()))
        set(value) { prefs.edit().putLong(KEY_ACCOUNT_POINTS, value.toRawBits()).apply() }

    var username: String?
        get() = prefs.getString(KEY_USERNAME, null)
        set(value) { prefs.edit().putString(KEY_USERNAME, value).apply() }

    var pointsValid: Boolean
        get() = prefs.getBoolean(KEY_POINTS_VALID, true)
        set(value) { prefs.edit().putBoolean(KEY_POINTS_VALID, value).apply() }

    /** Forgets the cached account so the next user doesn't see it. Unsynced records stay. */
    fun clearAccount() {
        prefs.edit()
            .remove(KEY_ACCOUNT_MS)
            .remove(KEY_ACCOUNT_POINTS)
            .remove(KEY_USERNAME)
            .remove(KEY_POINTS_VALID)
            .remove(KEY_LAST_SYNC)
            .apply()
    }

    fun buildStatus(isSyncing: Boolean = false, error: String? = null): SyncStatus {
        val records = all()
        val startOfDay = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }.timeInMillis
        val today = records.filter { it.startedAt >= startOfDay }
        return SyncStatus(
            lastSyncAt = lastSyncAt,
            pendingCount = records.count { !it.synced },
            todayFocusMinutes = today.sumOf { ((it.endedAt - it.startedAt) / 60_000L).toInt() },
            todaySessions = today.count { it.completed },
            accountFocusMs = accountFocusMs,
            accountPoints = accountPoints,
            username = username,
            pointsValid = pointsValid,
            isSyncing = isSyncing,
            lastError = error,
        )
    }

    private fun write(records: List<FocusRecord>) {
        val array = JSONArray()
        records.takeLast(MAX_RECORDS).forEach { r ->
            array.put(
                JSONObject()
                    .put("id", r.id)
                    .put("startedAt", r.startedAt)
                    .put("endedAt", r.endedAt)
                    .put("plannedMinutes", r.plannedMinutes)
                    .put("completed", r.completed)
                    .put("synced", r.synced)
            )
        }
        prefs.edit().putString(KEY_RECORDS, array.toString()).apply()
    }

    private companion object {
        const val KEY_RECORDS = "records"
        const val KEY_LAST_SYNC = "last_sync_at"
        const val KEY_ACCOUNT_MS = "account_focus_ms"
        const val KEY_ACCOUNT_POINTS = "account_points"
        const val KEY_USERNAME = "username"
        const val KEY_POINTS_VALID = "points_valid"
        const val MAX_RECORDS = 500
    }
}
