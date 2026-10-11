package com.focusflip.app.data.auth

import android.content.Context
import kotlinx.coroutines.delay
import org.json.JSONObject
import java.security.MessageDigest
import java.util.UUID

/**
 * MOCK BACKEND - replace with [RemoteAuthRepository] when the real API is ready.
 *
 * Accounts are stored locally in SharedPreferences as JSON so register/login behave
 * like a real server during development. A demo account is always available:
 *   email: demo@focusflip.app   password: demo1234
 */
class MockAuthRepository(
    context: Context,
    private val sessionStore: SessionStore,
) : AuthRepository {

    private val prefs = context.getSharedPreferences("focusflip_mock_accounts", Context.MODE_PRIVATE)

    init {
        if (!prefs.contains(DEMO_EMAIL)) {
            storeAccount(MockAccount("user-demo", DEMO_EMAIL, "Demo Student", hash(DEMO_PASSWORD)))
        }
    }

    override suspend fun login(email: String, password: String): AuthResult {
        delay(NETWORK_DELAY_MS)
        val normalized = email.trim().lowercase()
        val account = loadAccount(normalized)
            ?: return AuthResult.Failure("No account found for this email.")
        if (account.passwordHash != hash(password)) {
            return AuthResult.Failure("Incorrect password.")
        }
        return AuthResult.Success(startSession(account))
    }

    override suspend fun register(displayName: String, email: String, password: String): AuthResult {
        delay(NETWORK_DELAY_MS)
        val normalized = email.trim().lowercase()
        if (loadAccount(normalized) != null) {
            return AuthResult.Failure("An account with this email already exists.")
        }
        val account = MockAccount(
            id = "user-" + UUID.randomUUID().toString().take(8),
            email = normalized,
            displayName = displayName.trim(),
            passwordHash = hash(password),
        )
        storeAccount(account)
        return AuthResult.Success(startSession(account))
    }

    override suspend fun logout() {
        sessionStore.clear()
    }

    private fun startSession(account: MockAccount): AuthSession {
        val session = AuthSession(
            user = User(account.id, account.email, account.displayName),
            accessToken = "mock-token-" + UUID.randomUUID(),
        )
        sessionStore.save(session)
        return session
    }

    private data class MockAccount(
        val id: String,
        val email: String,
        val displayName: String,
        val passwordHash: String,
    )

    private fun storeAccount(a: MockAccount) {
        val json = JSONObject()
            .put("id", a.id)
            .put("email", a.email)
            .put("name", a.displayName)
            .put("hash", a.passwordHash)
        prefs.edit().putString(a.email, json.toString()).apply()
    }

    private fun loadAccount(email: String): MockAccount? {
        val raw = prefs.getString(email, null) ?: return null
        val json = JSONObject(raw)
        return MockAccount(
            id = json.getString("id"),
            email = json.getString("email"),
            displayName = json.getString("name"),
            passwordHash = json.getString("hash"),
        )
    }

    private fun hash(password: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(password.toByteArray())
            .joinToString("") { "%02x".format(it) }

    companion object {
        const val DEMO_EMAIL = "demo@focusflip.app"
        const val DEMO_PASSWORD = "demo1234"
        private const val NETWORK_DELAY_MS = 700L
    }
}
