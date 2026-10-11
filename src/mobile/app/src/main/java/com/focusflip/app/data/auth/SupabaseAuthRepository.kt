package com.focusflip.app.data.auth

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Accounts live in the shared Fishtank Supabase project (same as the desktop app,
 * see fishtank/src/database/accounts.js). Supabase Auth stores the password; the
 * `on_auth_user_created` trigger creates the matching `profiles` row from the
 * `username` sent in the sign-up metadata.
 *
 * Endpoints (Supabase GoTrue REST API):
 *   POST /auth/v1/signup                         { email, password, data: { username } }
 *   POST /auth/v1/token?grant_type=password      { email, password }
 *   POST /auth/v1/token?grant_type=refresh_token { refresh_token }
 *   POST /auth/v1/logout                         Bearer <access token>
 */
class SupabaseAuthRepository(
    private val supabaseUrl: String,
    private val publishableKey: String,
    private val sessionStore: SessionStore,
) : AuthRepository {

    override suspend fun login(email: String, password: String): AuthResult = call {
        val body = JSONObject().put("email", email.trim()).put("password", password)
        saveSession(post("/auth/v1/token?grant_type=password", body))
    }

    override suspend fun register(displayName: String, email: String, password: String): AuthResult = call {
        val body = JSONObject()
            .put("email", email.trim())
            .put("password", password)
            .put("data", JSONObject().put("username", displayName.trim()))
        val response = post("/auth/v1/signup", body)
        // With email confirmation enabled in Supabase, signup returns no session.
        if (!response.has("access_token")) {
            AuthResult.Failure("Account created. Check your email to confirm it, then log in.")
        } else {
            saveSession(response)
        }
    }

    /** Supabase refresh tokens work once, so two refreshes at the same time would log the user out. */
    private val refreshing = Mutex()

    override suspend fun refreshSession(): Boolean = refreshing.withLock { renew() }

    private suspend fun renew(): Boolean {
        val current = sessionStore.session.value ?: return false
        val refreshToken = current.refreshToken ?: run {
            sessionStore.clear()
            return false
        }
        if (System.currentTimeMillis() < current.expiresAt - REFRESH_MARGIN_MS) return true
        return try {
            withContext(Dispatchers.IO) {
                saveSession(post("/auth/v1/token?grant_type=refresh_token", JSONObject().put("refresh_token", refreshToken)))
            }
            true
        } catch (e: SupabaseException) {
            // 4xx: the refresh token was revoked or expired; the user must log in again.
            if (e.status in 400..499) sessionStore.clear()
            e.status !in 400..499
        } catch (e: IOException) {
            true // Offline: keep the stored session and try again next launch.
        }
    }

    override suspend fun logout() {
        val token = sessionStore.session.value?.accessToken
        sessionStore.clear()
        if (token != null) {
            // scope=local, as on the desktop: sessions on the user's other devices stay logged in.
            runCatching { withContext(Dispatchers.IO) { post("/auth/v1/logout?scope=local", JSONObject(), bearer = token) } }
        }
    }

    private suspend fun call(block: () -> AuthResult): AuthResult = withContext(Dispatchers.IO) {
        try {
            block()
        } catch (e: SupabaseException) {
            AuthResult.Failure(e.message ?: "Request failed.")
        } catch (e: IOException) {
            AuthResult.Failure("Can't reach the server. Check your internet connection.")
        }
    }

    private fun saveSession(json: JSONObject): AuthResult {
        val user = json.getJSONObject("user")
        val metadata = user.optJSONObject("user_metadata")
        val email = user.optString("email")
        val session = AuthSession(
            user = User(
                id = user.getString("id"),
                email = email,
                displayName = metadata?.optString("username").orEmpty().ifBlank { email.substringBefore('@') },
            ),
            accessToken = json.getString("access_token"),
            refreshToken = json.optString("refresh_token").ifBlank { null },
            expiresAt = System.currentTimeMillis() + json.optLong("expires_in", 3600L) * 1000L,
        )
        sessionStore.save(session)
        return AuthResult.Success(session)
    }

    /** POSTs JSON and returns the parsed body, throwing Supabase's error message on failure. */
    private fun post(path: String, body: JSONObject, bearer: String = publishableKey): JSONObject {
        val connection = URL(supabaseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15_000
            connection.readTimeout = 15_000
            connection.doOutput = true
            connection.setRequestProperty("apikey", publishableKey)
            connection.setRequestProperty("Authorization", "Bearer $bearer")
            connection.setRequestProperty("Content-Type", "application/json")
            connection.outputStream.use { it.write(body.toString().toByteArray()) }

            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            val json = runCatching { JSONObject(text) }.getOrNull() ?: JSONObject()
            if (status !in 200..299) {
                val message = listOf("msg", "error_description", "message")
                    .firstNotNullOfOrNull { key -> json.optString(key).takeIf { it.isNotBlank() } }
                throw SupabaseException(status, friendly(message) ?: "Request failed ($status).")
            }
            return json
        } finally {
            connection.disconnect()
        }
    }

    private fun friendly(message: String?): String? = when (message) {
        "Invalid login credentials" -> "Incorrect email or password."
        "User already registered" -> "An account with this email already exists."
        else -> message
    }

    private class SupabaseException(val status: Int, message: String) : Exception(message)

    private companion object {
        const val REFRESH_MARGIN_MS = 5 * 60_000L
    }
}
