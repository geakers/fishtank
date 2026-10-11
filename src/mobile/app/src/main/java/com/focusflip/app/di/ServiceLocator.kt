package com.focusflip.app.di

import android.content.Context
import com.focusflip.app.BuildConfig
import com.focusflip.app.data.apps.WhitelistStore
import com.focusflip.app.data.auth.AuthRepository
import com.focusflip.app.data.auth.MockAuthRepository
import com.focusflip.app.data.auth.SessionStore
import com.focusflip.app.data.auth.SupabaseAuthRepository
import com.focusflip.app.data.groups.GroupsRepository
import com.focusflip.app.data.sync.LocalRecordStore
import com.focusflip.app.data.sync.MockSyncRepository
import com.focusflip.app.data.sync.RemoteSyncRepository
import com.focusflip.app.data.sync.SyncRepository

/**
 * Mock vs. real backend. Accounts, study time, points and study groups use the shared
 * Fishtank Supabase project (fishtank/src/database: profiles.minutes_studied and points).
 */
object ServiceLocator {

    lateinit var sessionStore: SessionStore
        private set
    lateinit var authRepository: AuthRepository
        private set
    lateinit var syncRepository: SyncRepository
        private set
    lateinit var whitelistStore: WhitelistStore
        private set
    lateinit var groupsRepository: GroupsRepository
        private set

    fun init(context: Context) {
        val app = context.applicationContext
        sessionStore = SessionStore(app)
        whitelistStore = WhitelistStore(app)
        val records = LocalRecordStore(app)

        if (BuildConfig.USE_MOCK_BACKEND) {
            authRepository = MockAuthRepository(app, sessionStore)
            syncRepository = MockSyncRepository(records)
        } else {
            authRepository = SupabaseAuthRepository(
                BuildConfig.SUPABASE_URL,
                BuildConfig.SUPABASE_PUBLISHABLE_KEY,
                sessionStore,
            )
            syncRepository = RemoteSyncRepository(
                BuildConfig.SUPABASE_URL,
                BuildConfig.SUPABASE_PUBLISHABLE_KEY,
                sessionStore,
                authRepository,
                records,
            )
        }
        // Study groups need the real database; with the mock backend they fail to load.
        groupsRepository = GroupsRepository(
            BuildConfig.SUPABASE_URL,
            BuildConfig.SUPABASE_PUBLISHABLE_KEY,
            sessionStore,
            authRepository,
        )
    }

    /** Logs out and forgets the cached account. Unsynced sessions stay on the phone. */
    suspend fun logOut() {
        authRepository.logout()
        syncRepository.clearAccount()
    }
}
