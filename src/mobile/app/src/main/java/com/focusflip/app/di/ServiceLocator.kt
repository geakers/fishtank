package com.focusflip.app.di

import android.content.Context
import com.focusflip.app.BuildConfig
import com.focusflip.app.data.apps.WhitelistStore
import com.focusflip.app.data.auth.AuthRepository
import com.focusflip.app.data.auth.MockAuthRepository
import com.focusflip.app.data.auth.SessionStore
import com.focusflip.app.data.auth.SupabaseAuthRepository
import com.focusflip.app.data.sync.LocalRecordStore
import com.focusflip.app.data.sync.MockSyncRepository
import com.focusflip.app.data.sync.RemoteSyncRepository
import com.focusflip.app.data.sync.SyncRepository

/**
 * Mock vs. real backend. Accounts and focus time use the shared Fishtank
 * Supabase project (fishtank/src/database + profiles.focus_ms).
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
                records,
            )
        }
    }
}
