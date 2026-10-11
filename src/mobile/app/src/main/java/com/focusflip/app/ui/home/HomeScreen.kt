package com.focusflip.app.ui.home

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.focusflip.app.BuildConfig
import com.focusflip.app.data.auth.AuthSession
import com.focusflip.app.data.sync.SyncStatus
import com.focusflip.app.di.ServiceLocator
import com.focusflip.app.focus.FocusGuardService
import com.focusflip.app.focus.FocusSessionManager
import com.focusflip.app.focus.KioskMode
import com.focusflip.app.ui.lock.LockActivity
import com.focusflip.app.ui.theme.LcdPanel
import com.focusflip.app.ui.theme.LcdStatusBar
import com.focusflip.app.ui.theme.Retro
import com.focusflip.app.ui.theme.RetroButton
import com.focusflip.app.ui.theme.RetroLink
import com.focusflip.app.ui.theme.RetroScreen
import com.focusflip.app.ui.theme.formatClock
import com.focusflip.app.ui.theme.formatFocusTotal
import com.focusflip.app.ui.theme.rememberNow
import kotlinx.coroutines.launch

@Composable
fun HomeScreen(session: AuthSession, onOpenWhitelist: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val sync by ServiceLocator.syncRepository.status.collectAsStateWithLifecycle()
    val whitelist by ServiceLocator.whitelistStore.packages.collectAsStateWithLifecycle()

    var guardOn by remember { mutableStateOf(FocusGuardService.isEnabled(context)) }
    var deviceOwner by remember { mutableStateOf(KioskMode.isDeviceOwner(context)) }
    var fastMode by remember { mutableStateOf(FocusSessionManager.fastMode) }
    var showGuardDialog by remember { mutableStateOf(false) }
    var showLogoutDialog by remember { mutableStateOf(false) }

    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        guardOn = FocusGuardService.isEnabled(context)
        deviceOwner = KioskMode.isDeviceOwner(context)
        scope.launch { ServiceLocator.syncRepository.syncNow() }
    }

    val notificationPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* Countdown notification is optional; the session runs either way. */ }

    fun openAccessibilitySettings() {
        context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    fun startLock() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        FocusSessionManager.startFocus()
        LockActivity.launch(context)
    }

    HomeContent(
        displayName = session.user.displayName.ifBlank { session.user.email },
        sync = sync,
        whitelistCount = whitelist.size,
        guardOn = guardOn,
        deviceOwner = deviceOwner,
        fastMode = fastMode,
        onStartLock = { if (guardOn || deviceOwner) startLock() else showGuardDialog = true },
        onOpenWhitelist = onOpenWhitelist,
        onEnableGuard = { openAccessibilitySettings() },
        onSyncNow = { scope.launch { ServiceLocator.syncRepository.syncNow() } },
        onLogout = { showLogoutDialog = true },
        onFastModeChange = { fastMode = it; FocusSessionManager.fastMode = it },
        onReleaseDeviceOwner = {
            KioskMode.releaseDeviceOwner(context)
            deviceOwner = KioskMode.isDeviceOwner(context)
        },
    )

    if (showGuardDialog) {
        AlertDialog(
            onDismissRequest = { showGuardDialog = false },
            title = { Text("Enable Focus Guard") },
            text = {
                Text(
                    "To keep you inside FocusFlip during a focus block, turn on " +
                        "\"FocusFlip Focus Guard\" under Settings > Accessibility.\n\n" +
                        "Without it the timer still runs, but other apps are not blocked."
                )
            },
            confirmButton = {
                TextButton(onClick = { showGuardDialog = false; openAccessibilitySettings() }) {
                    Text("Open settings")
                }
            },
            dismissButton = {
                TextButton(onClick = { showGuardDialog = false; startLock() }) { Text("Start anyway") }
            },
        )
    }

    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title = { Text("Log out?") },
            text = { Text("You will need to sign in again next time.") },
            confirmButton = {
                TextButton(onClick = {
                    showLogoutDialog = false
                    scope.launch { ServiceLocator.authRepository.logout() }
                }) { Text("Log out") }
            },
            dismissButton = { TextButton(onClick = { showLogoutDialog = false }) { Text("Cancel") } },
        )
    }
}

/** Stateless home layout: LCD status panel + START LOCK / WHITELIST buttons. */
@Composable
fun HomeContent(
    displayName: String,
    sync: SyncStatus,
    whitelistCount: Int,
    guardOn: Boolean,
    deviceOwner: Boolean,
    fastMode: Boolean,
    onStartLock: () -> Unit,
    onOpenWhitelist: () -> Unit,
    onEnableGuard: () -> Unit,
    onSyncNow: () -> Unit,
    onLogout: () -> Unit,
    onFastModeChange: (Boolean) -> Unit,
    onReleaseDeviceOwner: () -> Unit,
) {
    val now = rememberNow()
    RetroScreen(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                "FOCUSFLIP",
                style = Retro.lcdText(14, bold = true, color = Retro.OnSky),
                modifier = Modifier.align(Alignment.CenterHorizontally),
            )

            LcdPanel(Modifier.fillMaxWidth()) {
                LcdStatusBar(now)
                Spacer(Modifier.height(12.dp))
                Text("HELLO,", style = Retro.lcdText(14))
                Text(displayName.uppercase(), style = Retro.lcdText(22, bold = true), maxLines = 1)
                Spacer(Modifier.height(10.dp))
                LcdLine("TOTAL", formatFocusTotal(sync.accountFocusMs))
                LcdLine("TODAY", "${sync.todayFocusMinutes} MIN / ${sync.todaySessions} BLOCKS")
                LcdLine("WHITELIST", "$whitelistCount APPS")
                LcdLine("GUARD", if (deviceOwner) "KIOSK" else if (guardOn) "ON" else "OFF")
                LcdLine(
                    "SYNC",
                    when {
                        sync.isSyncing -> "SYNCING..."
                        sync.lastSyncAt != null -> "${formatClock(sync.lastSyncAt)}  (${sync.pendingCount} PENDING)"
                        else -> "NEVER  (${sync.pendingCount} PENDING)"
                    },
                )
                sync.lastError?.let { Text("! $it", style = Retro.lcdText(11)) }
            }

            if (!guardOn && !deviceOwner) {
                Text(
                    "Focus Guard is OFF. Tap here to enable it in Accessibility settings, " +
                        "otherwise other apps cannot be blocked.",
                    style = Retro.lcdText(12, bold = true, color = Retro.Amber),
                    modifier = Modifier.clickable(onClick = onEnableGuard),
                )
            }

            RetroButton(
                text = "START LOCK",
                subtitle = if (fastMode) "45 sec focus / 15 sec break (dev)" else "45 min focus / 15 min break",
                accent = Retro.EndRed,
                height = 92.dp,
                textSize = 26,
                onClick = onStartLock,
                modifier = Modifier.fillMaxWidth(),
            )
            RetroButton(
                text = "WHITELIST",
                subtitle = "Apps allowed while locked",
                accent = Retro.CallGreen,
                height = 92.dp,
                textSize = 26,
                onClick = onOpenWhitelist,
                modifier = Modifier.fillMaxWidth(),
            )

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                RetroLink("SYNC NOW", onClick = onSyncNow)
                RetroLink("LOG OUT", onClick = onLogout)
            }

            if (BuildConfig.DEV_TOOLS) {
                DevTools(fastMode, onFastModeChange, deviceOwner, onReleaseDeviceOwner)
            }
        }
    }
}

@Composable
private fun LcdLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth()) {
        Text(label.padEnd(10), style = Retro.lcdText(13, bold = true))
        Text(value, style = Retro.lcdText(13), maxLines = 1)
    }
}

@Composable
private fun DevTools(
    fastMode: Boolean,
    onFastModeChange: (Boolean) -> Unit,
    deviceOwner: Boolean,
    onReleaseDeviceOwner: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("DEVELOPER (TEST BUILD)", style = Retro.lcdText(11, bold = true, color = Retro.OnSkyMuted))
        Text(
            (if (fastMode) "[X]" else "[ ]") + " Fast timers: 45 sec / 15 sec",
            style = Retro.lcdText(12, color = Retro.OnSky),
            modifier = Modifier
                .clickable { onFastModeChange(!fastMode) }
                .padding(vertical = 6.dp),
        )
        if (deviceOwner) {
            RetroLink("RELEASE DEVICE OWNER", onClick = onReleaseDeviceOwner, color = Retro.Amber)
        }
    }
}
