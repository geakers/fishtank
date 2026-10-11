package com.focusflip.app.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import com.focusflip.app.di.ServiceLocator
import com.focusflip.app.focus.FocusSessionManager
import com.focusflip.app.focus.Phase
import com.focusflip.app.ui.auth.AuthScreen
import com.focusflip.app.ui.groups.StudyGroupsScreen
import com.focusflip.app.ui.home.HomeScreen
import com.focusflip.app.ui.lock.LockActivity
import com.focusflip.app.ui.theme.FocusFlipTheme
import com.focusflip.app.ui.whitelist.WhitelistScreen
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Every screen draws its own backdrop under the system bars, as on iOS.
        enableEdgeToEdge()
        lifecycleScope.launch { ServiceLocator.authRepository.refreshSession() }
        setContent { FocusFlipTheme { FocusFlipRoot() } }
    }

    override fun onResume() {
        super.onResume()
        // A running session always takes over the app.
        FocusSessionManager.ensureTimerRunning()
        if (FocusSessionManager.state.value.phase != Phase.IDLE) LockActivity.launch(this)
    }
}

private enum class Screen { HOME, WHITELIST, GROUPS }

/** auth -> home -> whitelist / study groups. A running session opens LockActivity over all of it. */

@Composable
private fun FocusFlipRoot() {
    val session by ServiceLocator.sessionStore.session.collectAsStateWithLifecycle()
    var screen by rememberSaveable { mutableStateOf(Screen.HOME) }

    val current = session
    if (current == null) {
        AuthScreen()
        return
    }
    when (screen) {
        Screen.HOME -> HomeScreen(
            session = current,
            onOpenWhitelist = { screen = Screen.WHITELIST },
            onOpenGroups = { screen = Screen.GROUPS },
        )
        Screen.WHITELIST -> {
            BackHandler { screen = Screen.HOME }
            WhitelistScreen(onBack = { screen = Screen.HOME })
        }
        Screen.GROUPS -> {
            BackHandler { screen = Screen.HOME }
            StudyGroupsScreen(onBack = { screen = Screen.HOME })
        }
    }
}
