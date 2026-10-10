package com.focusflip.app.data.auth

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Persists the logged-in session so the user only has to log in once.
 * Expired access tokens are renewed with the refresh token.
 */
class SessionStore(context: Context) {

    private val prefs = context.getSharedPreferences("focusflip_session", Context.MODE_PRIVATE)
    private val _session = MutableStateFlow(read())
    val session: StateFlow<AuthSession?> = _session.asStateFlow()

    val isLoggedIn: Boolean get() = _session.value != null

    fun save(session: AuthSession) {
        prefs.edit()
            .putString(KEY_TOKEN, session.accessToken)
            .putString(KEY_REFRESH, session.refreshToken)
            .putLong(KEY_EXPIRES, session.expiresAt)
            .putString(KEY_USER_ID, session.user.id)
            .putString(KEY_EMAIL, session.user.email)
            .putString(KEY_NAME, session.user.displayName)
            .apply()
        _session.value = session
    }

    fun clear() {
        prefs.edit().clear().apply()
        _session.value = null
    }

    private fun read(): AuthSession? {
        val token = prefs.getString(KEY_TOKEN, null) ?: return null
        val id = prefs.getString(KEY_USER_ID, null) ?: return null
        return AuthSession(
            user = User(id, prefs.getString(KEY_EMAIL, "").orEmpty(), prefs.getString(KEY_NAME, "").orEmpty()),
            accessToken = token,
            refreshToken = prefs.getString(KEY_REFRESH, null),
            expiresAt = prefs.getLong(KEY_EXPIRES, Long.MAX_VALUE),
        )
    }

    private companion object {
        const val KEY_TOKEN = "access_token"
        const val KEY_REFRESH = "refresh_token"
        const val KEY_EXPIRES = "expires_at"
        const val KEY_USER_ID = "user_id"
        const val KEY_EMAIL = "email"
        const val KEY_NAME = "display_name"
    }
}
