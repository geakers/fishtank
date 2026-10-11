package com.focusflip.app.data.groups

import com.focusflip.app.data.auth.AuthRepository
import com.focusflip.app.data.auth.SessionStore
import com.focusflip.app.data.supabase.SupabaseException
import com.focusflip.app.data.supabase.SupabaseHttp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

/** A group study session (a row of study_groups). Called a group because session already means the login and the focus timer. */
data class StudyGroup(val id: Int, val name: String, val leaderId: String)

/** Someone in a group, from group_roster. [role] is "leader" or "member". */
data class GroupMember(val username: String, val role: String)

/** An invite the logged-in user hasn't answered yet, from my_invites. [leader] is the leader's username. */
data class GroupInvite(val groupId: Int, val groupName: String, val leader: String)

/**
 * Group study sessions, the same calls as src/desktop/groups.js and Groups.swift on iOS.
 * Row level security and the Postgres functions from src/database/study-groups.sql and
 * study-group-invites.sql decide what the logged-in user may see and change.
 */
class GroupsRepository(
    supabaseUrl: String,
    publishableKey: String,
    private val sessionStore: SessionStore,
    private val auth: AuthRepository,
) {
    private val http = SupabaseHttp(supabaseUrl, publishableKey)

    /** Creates a group led by the logged-in user. */
    suspend fun createGroup(name: String): StudyGroup {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) throw SupabaseException(0, "A study group name is required.")
        val rows = JSONArray(
            send("POST", "/rest/v1/study_groups?select=id,name,leader_id", JSONObject().put("name", trimmed), "return=representation")
        )
        if (rows.length() == 0) throw SupabaseException(0, "The group wasn't created.")
        return group(rows.getJSONObject(0))
    }

    /** The groups the logged-in user leads or is a member of, sorted by name. */
    suspend fun listGroups(): List<StudyGroup> =
        JSONArray(send("GET", "/rest/v1/study_groups?select=id,name,leader_id&order=name")).objects().map(::group)

    /** Everyone in the group, leader first. */
    suspend fun roster(groupId: Int): List<GroupMember> =
        JSONArray(rpc("group_roster", JSONObject().put("gid", groupId))).objects()
            .map { GroupMember(it.getString("username"), it.optString("role")) }

    /** Up to 10 usernames containing the search text. */
    suspend fun searchUsernames(query: String): List<String> =
        JSONArray(rpc("search_usernames", JSONObject().put("query", query))).objects().map { it.getString("username") }

    /** Invites the user with this username. They join once they accept. Leader only. */
    suspend fun invite(groupId: Int, username: String) {
        inviteRpc("invite_member", JSONObject().put("gid", groupId).put("member_username", username))
    }

    /** The invites waiting for the logged-in user, oldest first. */
    suspend fun myInvites(): List<GroupInvite> =
        JSONArray(inviteRpc("my_invites", JSONObject())).objects()
            .map { GroupInvite(it.getInt("group_id"), it.getString("group_name"), it.optString("leader")) }

    suspend fun acceptInvite(groupId: Int) {
        inviteRpc("accept_invite", JSONObject().put("gid", groupId))
    }

    suspend fun declineInvite(groupId: Int) {
        inviteRpc("decline_invite", JSONObject().put("gid", groupId))
    }

    /** Usernames invited to the group who haven't answered. Empty unless the user leads it. */
    suspend fun pendingInvites(groupId: Int): List<String> =
        JSONArray(inviteRpc("group_invites", JSONObject().put("gid", groupId))).objects().map { it.getString("username") }

    // ------------------------------------------------------------ requests

    private suspend fun rpc(name: String, args: JSONObject): String =
        send("POST", "/rest/v1/rpc/$name", args).ifBlank { "[]" }

    /** Supabase answers PGRST202 for a function it doesn't have, which means the invites SQL hasn't been run yet. */
    private suspend fun inviteRpc(name: String, args: JSONObject): String = try {
        rpc(name, args)
    } catch (e: SupabaseException) {
        if (e.code == "PGRST202") throw SupabaseException(404, "Invites aren't set up in the database yet.") else throw e
    }

    private suspend fun send(method: String, path: String, body: JSONObject? = null, prefer: String? = null): String {
        auth.refreshSession()
        val token = sessionStore.session.value?.accessToken ?: throw SupabaseException(401, "Log in first.")
        return withContext(Dispatchers.IO) { http.request(method, path, token, body, prefer) }
    }

    private fun group(row: JSONObject) = StudyGroup(row.getInt("id"), row.getString("name"), row.getString("leader_id"))

    private fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }
}
