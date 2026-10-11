package com.focusflip.app.ui.home

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.focusflip.app.BuildConfig
import com.focusflip.app.data.auth.AuthSession
import com.focusflip.app.data.groups.GroupInvite
import com.focusflip.app.data.groups.StudyGroup
import com.focusflip.app.data.sync.Points
import com.focusflip.app.data.sync.SyncStatus
import com.focusflip.app.di.ServiceLocator
import com.focusflip.app.focus.FinishedSession
import com.focusflip.app.focus.FocusGuardService
import com.focusflip.app.focus.FocusSessionManager
import com.focusflip.app.focus.KioskMode
import com.focusflip.app.ui.lock.LockActivity
import com.focusflip.app.ui.theme.Avatar
import com.focusflip.app.ui.theme.HeroButton
import com.focusflip.app.ui.theme.LcdPanel
import com.focusflip.app.ui.theme.LcdStatusBar
import com.focusflip.app.ui.theme.Orb
import com.focusflip.app.ui.theme.Retro
import com.focusflip.app.ui.theme.Wii
import com.focusflip.app.ui.theme.WiiBackdrop
import com.focusflip.app.ui.theme.WiiButton
import com.focusflip.app.ui.theme.formatClock
import com.focusflip.app.ui.theme.formatElapsed
import com.focusflip.app.ui.theme.formatFocusTotal
import com.focusflip.app.ui.theme.formatPoints
import com.focusflip.app.ui.theme.formatPointsGrouped
import com.focusflip.app.ui.theme.pressClick
import com.focusflip.app.ui.theme.rememberNow
import com.focusflip.app.ui.theme.selawik
import com.focusflip.app.ui.theme.wiiPill
import com.focusflip.app.ui.theme.wiiTile
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Laid out after the desktop home screen (src/frontend/views/screens/HomeScreen.tsx), like the
 * iOS app, with the flip phone where the desktop has its tank:
 *   top bar - brand on the left; points and profile on the right
 *   hero    - the flip phone on its stand; tap it or Focus to start a session, which first
 *             asks how long to commit to
 *   actions - Focus, then Study apps (the whitelist) and Focus Guard (Accessibility)
 *   panel   - study groups
 *   dock    - a big grey clock and the date
 */
@Composable
fun HomeScreen(session: AuthSession, onOpenWhitelist: () -> Unit, onOpenGroups: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val sync by ServiceLocator.syncRepository.status.collectAsStateWithLifecycle()
    val whitelist by ServiceLocator.whitelistStore.packages.collectAsStateWithLifecycle()
    val finished by FocusSessionManager.finished.collectAsStateWithLifecycle()

    var guardOn by remember { mutableStateOf(FocusGuardService.isEnabled(context)) }
    var deviceOwner by remember { mutableStateOf(KioskMode.isDeviceOwner(context)) }
    /** null until the first load finishes. */
    var groups by remember { mutableStateOf<List<StudyGroup>?>(null) }
    var invites by remember { mutableStateOf<List<GroupInvite>>(emptyList()) }
    var showCommit by remember { mutableStateOf(false) }
    var showGuardDialog by remember { mutableStateOf(false) }
    var showProfile by remember { mutableStateOf(false) }
    /** The minutes chosen in the commitment sheet, waiting on the Focus Guard question. */
    var pendingMinutes by remember { mutableIntStateOf(Points.DEFAULT_COMMIT_MINUTES) }

    fun reload() {
        scope.launch {
            ServiceLocator.syncRepository.syncNow()
            groups = runCatching { ServiceLocator.groupsRepository.listGroups() }.getOrElse { groups ?: emptyList() }
            invites = runCatching { ServiceLocator.groupsRepository.myInvites() }.getOrDefault(emptyList())
        }
    }

    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        guardOn = FocusGuardService.isEnabled(context)
        deviceOwner = KioskMode.isDeviceOwner(context)
        reload()
    }

    val notificationPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* The countdown notification is optional; the session runs either way. */ }

    fun openAccessibilitySettings() {
        context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    fun startLock(minutes: Int) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        FocusSessionManager.startFocus(minutes)
        LockActivity.launch(context)
    }

    fun commit(minutes: Int) {
        pendingMinutes = minutes
        if (guardOn || deviceOwner) startLock(minutes) else showGuardDialog = true
    }

    val displayName = (sync.username ?: session.user.displayName).ifBlank { session.user.email }

    HomeContent(
        displayName = displayName,
        sync = sync,
        whitelistCount = whitelist.size,
        guardLabel = if (deviceOwner) "Kiosk" else if (guardOn) "On" else "Off",
        guardOn = guardOn || deviceOwner,
        commitMinutes = FocusSessionManager.lastCommitMinutes,
        groups = groups,
        invites = invites,
        uid = session.user.id,
        onFocus = { showCommit = true },
        onOpenWhitelist = onOpenWhitelist,
        onGuard = { openAccessibilitySettings() },
        onOpenGroups = onOpenGroups,
        onProfile = { showProfile = true },
    )

    if (showCommit) {
        CommitSheet(
            initialMinutes = FocusSessionManager.lastCommitMinutes,
            onStart = { showCommit = false; commit(it) },
            onDismiss = { showCommit = false },
        )
    }

    if (showProfile) {
        ProfileSheet(
            name = displayName,
            email = session.user.email,
            sync = sync,
            deviceOwner = deviceOwner,
            onSyncNow = { scope.launch { ServiceLocator.syncRepository.syncNow() } },
            onLogout = { showProfile = false; scope.launch { ServiceLocator.logOut() } },
            onReleaseDeviceOwner = {
                KioskMode.releaseDeviceOwner(context)
                deviceOwner = KioskMode.isDeviceOwner(context)
            },
            onDismiss = { showProfile = false },
        )
    }

    finished?.let { done ->
        AlertDialog(
            onDismissRequest = FocusSessionManager::dismissFinished,
            title = { Text(if (done.completed) "Session complete" else "Ended early") },
            text = { Text(finishedMessage(done)) },
            confirmButton = { TextButton(onClick = FocusSessionManager::dismissFinished) { Text("OK") } },
        )
    }

    if (showGuardDialog) {
        AlertDialog(
            onDismissRequest = { showGuardDialog = false },
            title = { Text("Turn on Focus Guard?") },
            text = {
                Text(
                    "To keep you inside FocusFlip during a session, turn on " +
                        "\"FocusFlip Focus Guard\" under Settings > Accessibility.\n\n" +
                        "Without it the timer still runs, but other apps are not blocked."
                )
            },
            confirmButton = {
                TextButton(onClick = { showGuardDialog = false; openAccessibilitySettings() }) { Text("Open settings") }
            },
            dismissButton = {
                TextButton(onClick = { showGuardDialog = false; startLock(pendingMinutes) }) { Text("Start anyway") }
            },
        )
    }
}

private fun finishedMessage(done: FinishedSession): String =
    if (done.completed) {
        val points = Points.earnings(done.commitMinutes * 60L).points
        "You focused for the full ${done.commitMinutes} minutes and earned ${formatPoints(points)} points."
    } else {
        "You ended before your ${done.commitMinutes}-minute commitment, so this session earned no points. " +
            "Your ${formatElapsed(done.seconds)} of study still counts."
    }

/** Stateless home layout, so screenshot tests can draw it. */
@Composable
fun HomeContent(
    displayName: String,
    sync: SyncStatus,
    whitelistCount: Int,
    guardLabel: String,
    guardOn: Boolean,
    commitMinutes: Int,
    groups: List<StudyGroup>?,
    invites: List<GroupInvite>,
    uid: String?,
    onFocus: () -> Unit,
    onOpenWhitelist: () -> Unit,
    onGuard: () -> Unit,
    onOpenGroups: () -> Unit,
    onProfile: () -> Unit,
) {
    val now = rememberNow()
    WiiBackdrop {
        Column(Modifier.fillMaxSize()) {
            TopBar(
                points = sync.accountPoints,
                name = displayName,
                onProfile = onProfile,
                modifier = Modifier
                    .windowInsetsPadding(WindowInsets.statusBars)
                    .padding(horizontal = 16.dp)
                    .padding(top = 8.dp),
            )
            Column(
                Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp)
                    .padding(top = 32.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                PhoneHero(sync, guardLabel, commitMinutes, now, Modifier.pressClick(onClick = onFocus))
                HeroButton("Focus", onClick = onFocus, modifier = Modifier.padding(horizontal = 24.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    WiiButton("Study apps", onOpenWhitelist, Modifier.weight(1f), detail = "$whitelistCount")
                    WiiButton("Focus Guard", onGuard, Modifier.weight(1f), detail = guardLabel, warn = !guardOn)
                }
                GroupsPanel(groups, invites, uid, onOpenGroups)
            }
            Dock(now)
        }
    }
}

// ------------------------------------------------------------ top bar

@Composable
private fun TopBar(points: Double, name: String, onProfile: () -> Unit, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Orb(26.dp)
        Spacer(Modifier.size(8.dp))
        Text("FocusFlip", style = selawik(19, FontWeight.SemiBold))
        Spacer(Modifier.weight(1f).widthIn(min = 4.dp))
        Row(
            Modifier.height(36.dp).wiiPill().padding(start = 5.dp, end = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Orb(20.dp)
            Spacer(Modifier.size(5.dp))
            Text(formatPointsGrouped(points), style = selawik(14, FontWeight.Bold), maxLines = 1)
            Spacer(Modifier.size(4.dp))
            Text("pts", style = selawik(12, color = Wii.InkMuted))
        }
        Spacer(Modifier.size(8.dp))
        Row(
            Modifier
                .height(36.dp)
                .widthIn(max = 150.dp)
                .wiiPill()
                .pressClick(onClick = onProfile)
                .padding(start = 3.dp, end = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Avatar(name, 30.dp)
            Spacer(Modifier.size(6.dp))
            Text(
                name,
                style = selawik(14, FontWeight.SemiBold),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f, fill = false),
            )
            Spacer(Modifier.size(6.dp))
            Text("▾", style = selawik(10, color = Wii.InkMuted))
        }
    }
}

// ------------------------------------------------------------ hero: the flip phone on its stand

/**
 * Where the desktop shows its tank: the flip phone, open and idle, standing on the same
 * brushed-silver stand.
 */
@Composable
private fun PhoneHero(sync: SyncStatus, guardLabel: String, commitMinutes: Int, now: Long, modifier: Modifier) {
    Column(modifier) {
        MiniPhone(sync, guardLabel, commitMinutes, now, Modifier.padding(horizontal = 34.dp).padding(bottom = 10.dp))
        // The stand, like the desktop's tank cabinet.
        Box(
            Modifier
                .fillMaxWidth()
                .height(16.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(Wii.Metal)
                .border(1.dp, Wii.Line, RoundedCornerShape(4.dp))
        )
        Box(
            Modifier
                .padding(horizontal = 8.dp)
                .fillMaxWidth()
                .height(26.dp)
                .background(Wii.Tile)
                .drawBehind {
                    val inset = 5.dp.toPx()
                    drawRect(
                        Wii.LineSoft,
                        topLeft = androidx.compose.ui.geometry.Offset(inset, inset),
                        size = androidx.compose.ui.geometry.Size(size.width - 2 * inset, size.height - 2 * inset),
                        style = androidx.compose.ui.graphics.drawscope.Stroke(1.dp.toPx()),
                    )
                    drawLine(
                        Wii.LineSoft,
                        androidx.compose.ui.geometry.Offset(size.width / 2, inset),
                        androidx.compose.ui.geometry.Offset(size.width / 2, size.height - inset),
                        strokeWidth = 1.dp.toPx(),
                    )
                }
        )
    }
}

private val LidShape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp, bottomStart = 8.dp, bottomEnd = 8.dp)
private val BaseShape = RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp, bottomStart = 24.dp, bottomEnd = 24.dp)

/** An idle copy of the lock screen's flip phone: lid with the LCD, hinge, keypad. */
@Composable
private fun MiniPhone(sync: SyncStatus, guardLabel: String, commitMinutes: Int, now: Long, modifier: Modifier) {
    Column(
        modifier
            .fillMaxWidth()
            .shadow(14.dp, RoundedCornerShape(24.dp), clip = false, ambientColor = Wii.Shadow, spotColor = Wii.Shadow)
    ) {
        // Lid
        Column(
            Modifier
                .fillMaxWidth()
                .clip(LidShape)
                .background(Retro.silverBrush)
                .border(1.5.dp, Color.White, LidShape)
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Box(Modifier.size(width = 56.dp, height = 5.dp).clip(CircleShape).background(Retro.ShellDark))
            LcdPanel(Modifier.fillMaxWidth()) {
                LcdStatusBar(now)
                Spacer(Modifier.height(6.dp))
                Box(Modifier.fillMaxWidth().height(1.dp).background(Retro.LcdMid))
                Spacer(Modifier.height(22.dp))
                Text("READY", style = Retro.lcdText(13, bold = true, color = Retro.LcdMid))
                Text(formatElapsed(commitMinutes * 60), style = Retro.lcdText(52, bold = true))
                Text("PRESS FOCUS", style = Retro.lcdText(13, bold = true))
                Spacer(Modifier.height(28.dp))
                MiniLine("TOTAL", formatFocusTotal(sync.accountFocusMs))
                MiniLine("TODAY", "${sync.todayFocusMinutes} MIN")
                MiniLine("GUARD", guardLabel.uppercase())
                Spacer(Modifier.height(14.dp))
            }
            Text("FOCUSFLIP", style = Retro.lcdText(11, bold = true, color = Retro.ShellMid))
        }
        // Hinge
        Box(
            Modifier
                .padding(horizontal = 28.dp)
                .fillMaxWidth()
                .height(12.dp)
                .clip(RoundedCornerShape(5.dp))
                .background(Brush.verticalGradient(listOf(Retro.SilverDark, Retro.SilverLight, Retro.SilverDark)))
        )
        // Keypad (decoration only)
        Column(
            Modifier
                .fillMaxWidth()
                .clip(BaseShape)
                .background(Retro.silverBrush)
                .border(1.5.dp, Color.White, BaseShape)
                .padding(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 26.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                Modifier.padding(bottom = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                MiniKey(Modifier.weight(1f), Retro.CallGreen)
                Box(
                    Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(Retro.KeyFace)
                        .border(1.dp, Retro.SilverDark, CircleShape)
                )
                MiniKey(Modifier.weight(1f), Retro.EndRed)
            }
            repeat(4) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    repeat(3) { MiniKey(Modifier.weight(1f)) }
                }
            }
        }
    }
}

@Composable
private fun MiniLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth()) {
        Text(label, style = Retro.lcdText(13, bold = true))
        Spacer(Modifier.weight(1f))
        Text(value, style = Retro.lcdText(13), maxLines = 1)
    }
}

@Composable
private fun MiniKey(modifier: Modifier, color: Color = Retro.KeyFace) {
    Box(
        modifier
            .height(24.dp)
            .clip(CircleShape)
            .background(color)
            .border(1.dp, Retro.SilverDark.copy(alpha = 0.8f), CircleShape)
    )
}

// ------------------------------------------------------------ study groups panel

/**
 * The desktop's study groups panel, in brief: invites waiting and the user's groups.
 * Tapping it opens the full study groups screen.
 */
@Composable
private fun GroupsPanel(groups: List<StudyGroup>?, invites: List<GroupInvite>, uid: String?, onOpen: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .wiiTile()
            .pressClick(onClick = onOpen)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .drawBehind {
                    drawLine(
                        Wii.LineSoft,
                        androidx.compose.ui.geometry.Offset(0f, size.height),
                        androidx.compose.ui.geometry.Offset(size.width, size.height),
                        strokeWidth = 2.dp.toPx(),
                    )
                }
                .padding(bottom = 8.dp),
        ) {
            Text("Study groups", style = selawik(16, FontWeight.SemiBold))
            Spacer(Modifier.weight(1f))
            Text("Open ›", style = selawik(13, FontWeight.SemiBold, Wii.Cyan700))
        }

        invites.take(2).forEach { invite ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(Wii.Cyan500))
                Spacer(Modifier.size(8.dp))
                Text(invite.groupName, style = selawik(14, FontWeight.SemiBold), maxLines = 1)
                Spacer(Modifier.size(8.dp))
                Text("invite from ${invite.leader}", style = selawik(12, color = Wii.InkMuted), maxLines = 1)
            }
        }

        when {
            groups == null -> Text("Loading…", style = selawik(13, color = Wii.InkMuted))
            groups.isEmpty() && invites.isEmpty() ->
                Text("No study groups yet. Tap to start one.", style = selawik(13, color = Wii.InkMuted))
        }
        groups.orEmpty().take(4).forEach { group ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(group.name, style = selawik(14), maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (group.leaderId == uid) {
                    Spacer(Modifier.size(8.dp))
                    Text(
                        "Leader",
                        style = selawik(11, FontWeight.SemiBold, Wii.Cyan700),
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(Wii.Cyan100)
                            .padding(horizontal = 7.dp, vertical = 2.dp),
                    )
                }
            }
        }
        val more = groups.orEmpty().size - 4
        if (more > 0) Text("+$more more", style = selawik(12, color = Wii.InkMuted))
    }
}

// ------------------------------------------------------------ dock

/** The Wii-menu dock: big grey time with the date under it. */
@Composable
private fun Dock(now: Long) {
    Column(
        Modifier
            .fillMaxWidth()
            .shadow(7.dp, RoundedCornerShape(0.dp), ambientColor = Wii.Shadow, spotColor = Wii.Shadow)
            .background(Wii.Dock)
            .drawBehind {
                drawLine(
                    Wii.Line,
                    androidx.compose.ui.geometry.Offset(0f, 0f),
                    androidx.compose.ui.geometry.Offset(size.width, 0f),
                    strokeWidth = 2.dp.toPx(),
                )
            }
            .windowInsetsPadding(WindowInsets.navigationBars)
            .padding(top = 10.dp, bottom = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(now)),
            style = selawik(38, FontWeight.Light, Wii.DockTime),
        )
        Text(
            SimpleDateFormat("EEE M/d/yy", Locale.getDefault()).format(Date(now)),
            style = selawik(13, FontWeight.SemiBold, Wii.DockTime),
        )
    }
}

// ------------------------------------------------------------ commitment sheet

/**
 * Asked before every session: how long the user commits to. The session runs for exactly
 * that long, and only earns points if the user stays for all of it.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CommitSheet(initialMinutes: Int, onStart: (Int) -> Unit, onDismiss: () -> Unit) {
    var minutes by remember { mutableIntStateOf(initialMinutes) }
    // Steps of 5 minutes, or 1 below 5 so short sessions can be picked too.
    fun step(down: Boolean) = if (if (down) minutes <= 5 else minutes < 5) 1 else 5

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = Wii.Surface,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("How long will you focus?", style = selawik(20, FontWeight.SemiBold))
                Spacer(Modifier.weight(1f))
                Text(
                    "Cancel",
                    style = selawik(15, FontWeight.SemiBold, Wii.Cyan700),
                    modifier = Modifier.pressClick(onClick = onDismiss),
                )
            }
            Text(
                "The session ends by itself when the time is up. You only earn points if you stay for all of it.",
                style = selawik(14, color = Wii.InkMuted),
                modifier = Modifier.fillMaxWidth(),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Points.COMMIT_PRESETS.forEach { preset ->
                    val chosen = minutes == preset
                    Box(
                        Modifier
                            .weight(1f)
                            .height(38.dp)
                            .wiiPill(border = if (chosen) Wii.Cyan500 else Wii.Line)
                            .pressClick { minutes = preset },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("$preset", style = selawik(15, FontWeight.SemiBold, if (chosen) Wii.Cyan700 else Wii.Ink))
                    }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                StepButton("−") { minutes = (minutes - step(down = true)).coerceAtLeast(Points.MIN_COMMIT_MINUTES) }
                Column(Modifier.widthIn(min = 110.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("$minutes", style = selawik(54, FontWeight.Light))
                    Text(if (minutes == 1) "minute" else "minutes", style = selawik(13, FontWeight.SemiBold, Wii.InkMuted))
                }
                StepButton("+") { minutes = (minutes + step(down = false)).coerceAtMost(Points.MAX_COMMIT_MINUTES) }
            }
            Text(
                "+${formatPoints(Points.earnings(minutes * 60L).points)} points if you finish",
                style = selawik(14, FontWeight.SemiBold, Wii.Cyan700),
            )
            HeroButton("Start", onClick = { onStart(minutes) })
        }
    }
}

@Composable
private fun StepButton(symbol: String, onClick: () -> Unit) {
    Box(Modifier.size(52.dp).wiiPill().pressClick(onClick = onClick), contentAlignment = Alignment.Center) {
        Text(symbol, style = selawik(26, FontWeight.SemiBold, Wii.Cyan700))
    }
}

// ------------------------------------------------------------ profile sheet

/** The desktop's profile menu: the user, their stats as tiles, sync and log out. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProfileSheet(
    name: String,
    email: String,
    sync: SyncStatus,
    deviceOwner: Boolean,
    onSyncNow: () -> Unit,
    onLogout: () -> Unit,
    onReleaseDeviceOwner: () -> Unit,
    onDismiss: () -> Unit,
) {
    var confirmLogout by remember { mutableStateOf(false) }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Wii.Surface) {
        Column(
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Avatar(name, 48.dp)
                Spacer(Modifier.size(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(name, style = selawik(20, FontWeight.SemiBold), maxLines = 1)
                    Text(email, style = selawik(13, color = Wii.InkMuted), maxLines = 1)
                }
                Text("Done", style = selawik(15, FontWeight.SemiBold, Wii.Cyan700), modifier = Modifier.pressClick(onClick = onDismiss))
            }

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatTile(formatPointsGrouped(sync.accountPoints), "Points", Modifier.weight(1f))
                StatTile(formatFocusTotal(sync.accountFocusMs).lowercase(), "Focus time", Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatTile("${sync.todayFocusMinutes} min", "Today", Modifier.weight(1f))
                StatTile("${sync.todaySessions}", "Sessions today", Modifier.weight(1f))
            }

            if (!sync.pointsValid) {
                Text("Your points don't match your study time.", style = selawik(13, FontWeight.SemiBold, Wii.Danger))
            }

            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Sync", style = selawik(13, FontWeight.SemiBold, Wii.InkMuted))
                Text(syncLabel(sync), style = selawik(14))
                sync.lastError?.let { Text(it, style = selawik(13, FontWeight.SemiBold, Wii.Danger)) }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                WiiButton(if (sync.isSyncing) "Syncing…" else "Sync now", onSyncNow, Modifier.weight(1f))
                WiiButton("Log out", { confirmLogout = true }, Modifier.weight(1f))
            }

            if (BuildConfig.DEV_TOOLS && deviceOwner) {
                Text("Developer (test build)", style = selawik(13, FontWeight.SemiBold, Wii.InkMuted))
                WiiButton("Release device owner", onReleaseDeviceOwner, Modifier.fillMaxWidth(), warn = true)
            }
        }
    }

    if (confirmLogout) {
        AlertDialog(
            onDismissRequest = { confirmLogout = false },
            title = { Text("Log out?") },
            text = { Text("You will need to sign in again next time.") },
            confirmButton = { TextButton(onClick = { confirmLogout = false; onLogout() }) { Text("Log out") } },
            dismissButton = { TextButton(onClick = { confirmLogout = false }) { Text("Cancel") } },
        )
    }
}

private fun syncLabel(sync: SyncStatus): String {
    val synced = sync.lastSyncAt?.let { "Last synced ${formatClock(it)}" } ?: "Never synced"
    // Only mention sessions when some are still waiting to be saved.
    val pending = sync.pendingCount
    return if (pending == 0) synced else "$synced, $pending session${if (pending == 1) "" else "s"} waiting"
}

@Composable
private fun StatTile(value: String, label: String, modifier: Modifier) {
    Column(
        modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(2.dp, Wii.LineSoft, RoundedCornerShape(16.dp))
            .padding(vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(value, style = selawik(22, FontWeight.SemiBold, Wii.Cyan700), maxLines = 1)
        Text(label, style = selawik(13, color = Wii.InkMuted))
    }
}
