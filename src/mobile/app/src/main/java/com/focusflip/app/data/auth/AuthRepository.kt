package com.focusflip.app.data.auth

/** Account as returned by the backend. Mirrors the desktop app's user object. */
data class User(
    val id: String,
    val email: String,
    val displayName: String,
)

/** A logged-in session: the user plus the bearer token used for every sync request. */
data class AuthSession(
    val user: User,
    val accessToken: String,
    val refreshToken: String? = null,
    /** Epoch ms when [accessToken] expires; Long.MAX_VALUE for tokens that never expire. */
    val expiresAt: Long = Long.MAX_VALUE,
)

sealed class AuthResult {
    data class Success(val session: AuthSession) : AuthResult()
    data class Failure(val message: String) : AuthResult()
}

/**
 * Contract between the UI and the account backend.
 *
 * Implementations:
 *  - [SupabaseAuthRepository] the shared Fishtank Supabase project (default)
 *  - [MockAuthRepository]     offline, stores accounts on the device (USE_MOCK_AUTH = true)
 *
 * Chosen in [com.focusflip.app.di.ServiceLocator].
 */
interface AuthRepository {
    suspend fun login(email: String, password: String): AuthResult

    /** [displayName] is stored as the account's username. */
    suspend fun register(displayName: String, email: String, password: String): AuthResult
    suspend fun logout()

    /**
     * Renews the stored session if its access token is about to expire.
     * Returns false only when the session is no longer valid and the user must log in again.
     */
    suspend fun refreshSession(): Boolean = true
}
