package com.focusflip.app

import android.app.Application
import com.focusflip.app.di.ServiceLocator
import com.focusflip.app.focus.FocusSessionManager
import com.focusflip.app.focus.Notifications

class FocusFlipApp : Application() {
    override fun onCreate() {
        super.onCreate()
        ServiceLocator.init(this)
        Notifications.createChannel(this)
        FocusSessionManager.init(this)
    }
}
