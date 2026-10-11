package com.focusflip.app.ui.lock

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.focusflip.app.data.sync.Points
import com.focusflip.app.focus.Phase
import com.focusflip.app.focus.SessionState
import com.focusflip.app.ui.theme.LcdPanel
import com.focusflip.app.ui.theme.gloss
import com.focusflip.app.ui.theme.LcdProgress
import com.focusflip.app.ui.theme.LcdStatusBar
import com.focusflip.app.ui.theme.Retro
import com.focusflip.app.ui.theme.WiiBackdrop
import com.focusflip.app.ui.theme.formatElapsed
import com.focusflip.app.ui.theme.formatPoints
import com.focusflip.app.ui.theme.rememberNow
import kotlinx.coroutines.delay

data class LockApp(val packageName: String, val label: String)

private enum class Page { APPS, CLOCK }

private sealed interface Key {
    data object Up : Key
    data object Down : Key
    data object Left : Key
    data object Right : Key
    data object Ok : Key
    data object SoftLeft : Key
    data object SoftRight : Key
    data object Call : Key
    data object End : Key
    data class Digit(val char: Char) : Key
}

private val QUOTES = listOf(
    "One thing at a time.",
    "Future you says thanks.",
    "Deep work, no apps.",
    "Stay. Focus. Win.",
    "Your phone can wait.",
)

/**
 * The whole lock UI: top half is the LCD, bottom half is the keypad.
 * Up/Down choose an item, OK/Call opens it, Left/Right or the right soft key switch pages,
 * End (the red key) ends the session early, 1-9 jump straight to that list entry, * toggles
 * the backlight. The session ends by itself when the time committed to runs out.
 */
@Composable
fun FlipPhoneScreen(
    state: SessionState,
    apps: List<LockApp>,
    onLaunchApp: (LockApp) -> Unit,
    onEndEarly: () -> Unit,
    onKeyTone: (Char) -> Unit,
) {
    val haptics = LocalHapticFeedback.current
    var page by remember { mutableStateOf(Page.APPS) }
    var selected by remember { mutableIntStateOf(0) }
    var backlight by remember { mutableStateOf(true) }
    var toast by remember { mutableStateOf<String?>(null) }
    var confirmEnd by remember { mutableStateOf(false) }

    LaunchedEffect(state.startedAt) {
        selected = 0
        page = Page.APPS
    }
    LaunchedEffect(toast) {
        if (toast != null) {
            delay(1_800)
            toast = null
        }
    }

    val itemCount = if (page == Page.APPS) apps.size else 0

    fun activate() {
        when {
            page == Page.CLOCK -> page = Page.APPS
            apps.isEmpty() -> toast = "Whitelist is empty"
            else -> apps.getOrNull(selected)?.let {
                toast = "Opening ${it.label}..."
                onLaunchApp(it)
            }
        }
    }

    fun press(key: Key) {
        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        onKeyTone(if (key is Key.Digit) key.char else '.')
        when (key) {
            Key.Up -> if (itemCount > 0) selected = (selected - 1 + itemCount) % itemCount
            Key.Down -> if (itemCount > 0) selected = (selected + 1) % itemCount
            Key.Left, Key.Right, Key.SoftRight ->
                if (state.phase == Phase.FOCUS) page = if (page == Page.APPS) Page.CLOCK else Page.APPS
            Key.Ok, Key.SoftLeft, Key.Call -> activate()
            // The red END key ends the session, after a confirmation.
            Key.End -> if (state.phase == Phase.FOCUS) confirmEnd = true
            is Key.Digit -> when (key.char) {
                '*' -> backlight = !backlight
                '#' -> toast = QUOTES.random()
                in '1'..'9' -> {
                    val index = key.char - '1'
                    if (index < itemCount) selected = index
                }
            }
        }
    }

    // The same Wii-white pinstripe backdrop as the home screen, the iOS app and the desktop.
    WiiBackdrop {
        Column(Modifier.fillMaxSize().padding(horizontal = 14.dp, vertical = 10.dp)) {
            Lid(Modifier.weight(1f)) {
                LcdPanel(Modifier.fillMaxSize(), backlight = backlight, contentPadding = 10.dp, fillHeight = true) {
                    LcdContent(state, apps, page, selected, toast)
                }
            }
            Hinge()
            Base(Modifier.weight(1.08f), onKey = { press(it) })
        }
    }

    if (confirmEnd && state.phase == Phase.FOCUS) {
        AlertDialog(
            onDismissRequest = { confirmEnd = false },
            title = { Text("End early?") },
            text = {
                Text(
                    "You committed to ${state.commitMinutes} minutes and have " +
                        "${formatElapsed(state.remainingSeconds())} to go. If you stop now your study " +
                        "time still counts, but you won't earn any points."
                )
            },
            confirmButton = {
                TextButton(onClick = { confirmEnd = false }) { Text("Keep focusing") }
            },
            dismissButton = {
                TextButton(onClick = { confirmEnd = false; onEndEarly() }) {
                    Text("End without points", color = Retro.EndRed)
                }
            },
        )
    }
}

// ---------------------------------------------------------------- LCD

@Composable
private fun ColumnScope.LcdContent(
    state: SessionState,
    apps: List<LockApp>,
    page: Page,
    selected: Int,
    toast: String?,
) {
    val now = rememberNow()
    val remaining = state.remainingSeconds(now)
    val progress = state.progress(now)

    LcdStatusBar(now)
    Spacer(Modifier.height(6.dp))
    Box(Modifier.fillMaxWidth().height(1.dp).background(Retro.LcdMid))
    Spacer(Modifier.height(6.dp))

    Column(Modifier.weight(1f).fillMaxWidth()) {
        when (page) {
            Page.CLOCK -> ClockPage(state, remaining, progress)
            Page.APPS -> AppsPage(state, remaining, progress, apps, selected)
        }
    }

    if (toast != null) {
        Text(
            toast,
            style = Retro.lcdText(12, bold = true, color = Retro.Lcd),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .fillMaxWidth()
                .background(Retro.LcdInk)
                .padding(horizontal = 6.dp, vertical = 3.dp),
        )
        Spacer(Modifier.height(4.dp))
    }

    val (left, right) = when (page) {
        Page.CLOCK -> "Apps" to "Apps"
        Page.APPS -> "Open" to "Clock"
    }
    Box(Modifier.fillMaxWidth().height(1.dp).background(Retro.LcdMid))
    Row(Modifier.fillMaxWidth().padding(top = 4.dp)) {
        Text(left, style = Retro.lcdText(13, bold = true))
        Spacer(Modifier.weight(1f))
        Text("MENU", style = Retro.lcdText(11))
        Spacer(Modifier.weight(1f))
        Text(right, style = Retro.lcdText(13, bold = true))
    }
}

/** What the session earns if the user stays for all of it. */
private fun commitPoints(state: SessionState): Double = Points.earnings(state.commitMinutes * 60L).points

@Composable
private fun AppsPage(state: SessionState, remaining: Int, progress: Float, apps: List<LockApp>, selected: Int) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("FOCUS ${state.commitMinutes} MIN", style = Retro.lcdText(14, bold = true))
        Spacer(Modifier.weight(1f))
        Text(formatElapsed(remaining), style = Retro.lcdText(20, bold = true))
    }
    Spacer(Modifier.height(4.dp))
    LcdProgress(progress)
    Spacer(Modifier.height(4.dp))
    Text("+${formatPoints(commitPoints(state))} PTS IF YOU FINISH", style = Retro.lcdText(12, bold = true, color = Retro.LcdMid))
    Spacer(Modifier.height(8.dp))
    Text("ALLOWED APPS", style = Retro.lcdText(11, bold = true, color = Retro.LcdMid))
    Spacer(Modifier.height(2.dp))

    if (apps.isEmpty()) {
        Text(
            "No apps on the whitelist.\nAdd some from the home screen\nafter this session.",
            style = Retro.lcdText(13),
        )
        return
    }
    val listState = rememberLazyListState()
    LaunchedEffect(selected) { listState.animateScrollToItem((selected - 2).coerceAtLeast(0)) }
    LazyColumn(state = listState) {
        itemsIndexed(apps, key = { _, app -> app.packageName }) { index, app ->
            MenuRow("${index + 1}", app.label, index == selected)
        }
    }
}

@Composable
private fun ClockPage(state: SessionState, remaining: Int, progress: Float) {
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Text("TIME LEFT", style = Retro.lcdText(13, bold = true))
        Text(formatElapsed(remaining), style = Retro.lcdText(54, bold = true), maxLines = 1)
        Text("+${formatPoints(commitPoints(state))} PTS AT THE END", style = Retro.lcdText(13, bold = true, color = Retro.LcdMid))
        Spacer(Modifier.height(10.dp))
        LcdProgress(progress)
        Spacer(Modifier.height(10.dp))
        Text("PHONE LOCKED", style = Retro.lcdText(13, bold = true), textAlign = TextAlign.Center)
    }
}

@Composable
private fun MenuRow(prefix: String, label: String, highlighted: Boolean) {
    val ink = if (highlighted) Retro.Lcd else Retro.LcdInk
    Row(
        Modifier
            .fillMaxWidth()
            .background(if (highlighted) Retro.LcdInk else Color.Transparent)
            .padding(horizontal = 6.dp, vertical = 4.dp),
    ) {
        Text(prefix, style = Retro.lcdText(15, bold = true, color = ink))
        Spacer(Modifier.width(8.dp))
        Text(label, style = Retro.lcdText(15, bold = highlighted, color = ink), maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

// ---------------------------------------------------------------- shell

@Composable
private fun Lid(modifier: Modifier, screen: @Composable BoxScope.() -> Unit) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(LidShape)
            .background(Retro.silverBrush)
            .border(1.5.dp, Color.White, LidShape)
            .gloss(fraction = 0.12f, alpha = 0.9f, corner = 24.dp)
            .padding(10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Earpiece slot
        Box(
            Modifier
                .padding(top = 6.dp, bottom = 8.dp)
                .width(70.dp)
                .height(7.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(Retro.ShellDark)
        )
        Box(
            Modifier
                .weight(1f)
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(Brush.verticalGradient(listOf(Color(0xFF1E6A9C), Retro.ShellDark)))
                .padding(10.dp),
            content = screen,
        )
        Text(
            "FOCUSFLIP",
            style = Retro.lcdText(12, bold = true, color = Retro.ShellMid),
            modifier = Modifier.padding(top = 6.dp),
        )
    }
}

@Composable
private fun Hinge() {
    Box(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp)
            .height(16.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(Brush.verticalGradient(listOf(Retro.SilverDark, Retro.SilverLight, Retro.SilverDark)))
    )
}

@Composable
private fun Base(modifier: Modifier, onKey: (Key) -> Unit) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(BaseShape)
            .background(Retro.silverBrush)
            .border(1.5.dp, Color.White, BaseShape)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // Soft keys + call/end around the D-pad
        Row(Modifier.weight(1.45f).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = Arrangement.SpaceEvenly) {
                PillKey("—", onClick = { onKey(Key.SoftLeft) })
                PillKey("CALL", color = Retro.CallGreen, textColor = Color.White, onClick = { onKey(Key.Call) })
            }
            DPad(Modifier.padding(horizontal = 10.dp).fillMaxHeight(), onKey)
            Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = Arrangement.SpaceEvenly) {
                PillKey("—", onClick = { onKey(Key.SoftRight) })
                PillKey("END", color = Retro.EndRed, textColor = Color.White, onClick = { onKey(Key.End) })
            }
        }

        val rows = listOf(
            listOf("1" to "", "2" to "ABC", "3" to "DEF"),
            listOf("4" to "GHI", "5" to "JKL", "6" to "MNO"),
            listOf("7" to "PQRS", "8" to "TUV", "9" to "WXYZ"),
            listOf("*" to "LIGHT", "0" to "+", "#" to "TIP"),
        )
        rows.forEach { row ->
            Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { (digit, letters) ->
                    NumberKey(digit, letters, Modifier.weight(1f).fillMaxHeight()) { onKey(Key.Digit(digit[0])) }
                }
            }
        }

        // Microphone pinhole
        Box(Modifier.width(6.dp).height(6.dp).clip(CircleShape).background(Retro.ShellDark))
    }
}

private val LidShape = RoundedCornerShape(topStart = 34.dp, topEnd = 34.dp, bottomStart = 10.dp, bottomEnd = 10.dp)
private val BaseShape = RoundedCornerShape(topStart = 10.dp, topEnd = 10.dp, bottomStart = 40.dp, bottomEnd = 40.dp)

/** Glossy candy-plastic fill for a key; darker and flatter while pressed. */
@Composable
private fun keyBrush(source: MutableInteractionSource, base: Color): Brush {
    val isPressed by source.collectIsPressedAsState()
    return if (isPressed) {
        Brush.verticalGradient(listOf(lerp(base, Color.Black, 0.12f), lerp(base, Color.Black, 0.2f)))
    } else {
        Brush.verticalGradient(listOf(lerp(base, Color.White, 0.35f), base, lerp(base, Retro.SilverDark, 0.35f)))
    }
}

@Composable
private fun NumberKey(digit: String, letters: String, modifier: Modifier, onClick: () -> Unit) {
    val source = remember { MutableInteractionSource() }
    Box(
        modifier
            .clip(RoundedCornerShape(50))
            .background(keyBrush(source, Retro.KeyFace))
            .border(BorderStroke(1.dp, Retro.SilverDark), RoundedCornerShape(50))
            .gloss(fraction = 0.5f, alpha = 0.85f, corner = 18.dp)
            .clickable(interactionSource = source, indication = null, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(digit, style = Retro.lcdText(20, bold = true, color = Retro.KeyText))
            if (letters.isNotEmpty()) {
                Spacer(Modifier.width(6.dp))
                Text(letters, style = Retro.lcdText(9, color = Retro.ShellMid))
            }
        }
    }
}

@Composable
private fun PillKey(
    label: String,
    color: Color = Retro.KeyFace,
    textColor: Color = Retro.KeyText,
    height: Dp = 34.dp,
    onClick: () -> Unit,
) {
    val source = remember { MutableInteractionSource() }
    Box(
        Modifier
            .fillMaxWidth()
            .height(height)
            .clip(RoundedCornerShape(50))
            .background(keyBrush(source, color))
            .border(BorderStroke(1.dp, Retro.SilverDark), RoundedCornerShape(50))
            .gloss(fraction = 0.5f, alpha = 0.8f, corner = 14.dp)
            .clickable(interactionSource = source, indication = null, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, style = Retro.lcdText(12, bold = true, color = textColor))
    }
}

@Composable
private fun DPad(modifier: Modifier, onKey: (Key) -> Unit) {
    Box(
        modifier
            .aspectRatio(1f)
            .clip(CircleShape)
            .background(Brush.radialGradient(listOf(Retro.SilverLight, Retro.Silver, Retro.SilverDark)))
            .border(2.dp, Color.White, CircleShape)
            .gloss(fraction = 0.45f, alpha = 0.6f, corner = 60.dp),
    ) {
        Arrow(Modifier.align(Alignment.TopCenter), 0f) { onKey(Key.Up) }
        Arrow(Modifier.align(Alignment.BottomCenter), 180f) { onKey(Key.Down) }
        Arrow(Modifier.align(Alignment.CenterStart), 270f) { onKey(Key.Left) }
        Arrow(Modifier.align(Alignment.CenterEnd), 90f) { onKey(Key.Right) }

        val source = remember { MutableInteractionSource() }
        Box(
            Modifier
                .align(Alignment.Center)
                .fillMaxSize(0.4f)
                .clip(CircleShape)
                .background(keyBrush(source, Retro.KeyFace))
                .border(2.dp, Retro.SilverDark, CircleShape)
                .gloss(fraction = 0.5f, alpha = 0.85f, corner = 30.dp)
                .clickable(interactionSource = source, indication = null) { onKey(Key.Ok) },
            contentAlignment = Alignment.Center,
        ) {
            Text("OK", style = Retro.lcdText(14, bold = true, color = Retro.KeyText))
        }
    }
}

/** One arrow segment of the D-pad. [rotation] 0 = up, clockwise in degrees. */
@Composable
private fun Arrow(modifier: Modifier, rotation: Float, onClick: () -> Unit) {
    val source = remember { MutableInteractionSource() }
    val isPressed by source.collectIsPressedAsState()
    Box(
        modifier
            .fillMaxSize(0.3f)
            .clip(CircleShape)
            .clickable(interactionSource = source, indication = null, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.fillMaxSize(0.45f)) {
            val c = Offset(size.width / 2, size.height / 2)
            val path = Path().apply {
                moveTo(c.x, 0f)
                lineTo(size.width, size.height * 0.8f)
                lineTo(0f, size.height * 0.8f)
                close()
            }
            rotate(rotation, c) {
                drawPath(path, if (isPressed) Retro.ShellDark else Retro.ShellMid)
            }
        }
    }
}
