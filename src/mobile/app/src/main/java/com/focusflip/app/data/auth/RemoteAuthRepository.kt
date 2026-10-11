package com.focusflip.app.data.auth

/**
 * REAL BACKEND - skeleton to fill in once the cloud API is available.
 *
 * Expected endpoints (see README "Backend integration"):
 *   POST {API_BASE_URL}auth/login     body: { email, password }
 *   POST {API_BASE_URL}auth/register  body: { displayName, email, password }
 *   POST {API_BASE_URL}auth/logout    header: Authorization: Bearer <token>
 * Response for login/register:
 *   { "token": "...", "user": { "id": "...", "email": "...", "displayName": "..." } }
 *
 * On success, call [SessionStore.save] so the session persists across app launches.
 * Then flip USE_MOCK_BACKEND to false in app/build.gradle.kts.
 */
class RemoteAuthRepository(
    private val baseUrl: String,
    private val sessionStore: SessionStore,
) : AuthRepository {

    override suspend fun login(email: String, password: String): AuthResult {
        // TODO(backend): call POST auth/login, parse the response, sessionStore.save(session)
        return AuthResult.Failure("Remote backend not implemented yet ($baseUrl).")
    }

    override suspend fun register(displayName: String, email: String, password: String): AuthResult {
        // TODO(backend): call POST auth/register, parse the response, sessionStore.save(session)
        return AuthResult.Failure("Remote backend not implemented yet ($baseUrl).")
    }

    override suspend fun logout() {
        // TODO(backend): call POST auth/logout (best effort), then clear locally.
        sessionStore.clear()
    }
}
