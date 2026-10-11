package com.focusflip.app.ui.whitelist

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.focusflip.app.data.apps.InstalledApp
import com.focusflip.app.data.apps.InstalledApps
import com.focusflip.app.di.ServiceLocator
import com.focusflip.app.ui.theme.Wii
import com.focusflip.app.ui.theme.WiiBackdrop
import com.focusflip.app.ui.theme.pressClick
import com.focusflip.app.ui.theme.selawik
import com.focusflip.app.ui.theme.wiiPill
import com.focusflip.app.ui.theme.wiiTile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Study apps: the apps that can be opened from the lock screen. Styled after the desktop's
 * Study apps panel (src/frontend/views/components/StudyApps.tsx) on its home screen
 * backdrop, like the iOS app. Ticking an app saves straight away.
 */
@Composable
fun WhitelistScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val selected by ServiceLocator.whitelistStore.packages.collectAsStateWithLifecycle()
    var apps by remember { mutableStateOf<List<InstalledApp>?>(null) }
    var query by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        apps = withContext(Dispatchers.IO) { InstalledApps.load(context) }
    }

    val visible = apps.orEmpty().filter {
        query.isBlank() || it.label.contains(query, ignoreCase = true) || it.packageName.contains(query, ignoreCase = true)
    }

    WiiBackdrop {
        Column(
            Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .padding(horizontal = 16.dp)
                .padding(top = 8.dp, bottom = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.height(36.dp).wiiPill().pressClick(onClick = onBack).padding(horizontal = 16.dp), contentAlignment = Alignment.Center) {
                    Text("‹ Home", style = selawik(15, FontWeight.SemiBold))
                }
                Spacer(Modifier.weight(1f))
                Text(
                    "${selected.size} chosen",
                    style = selawik(13, FontWeight.SemiBold, Wii.Cyan700),
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .background(Wii.Cyan100)
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                )
            }

            Column(
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .wiiTile()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    "Study apps",
                    style = selawik(18, FontWeight.SemiBold),
                    modifier = Modifier.fillMaxWidth().underline().padding(bottom = 8.dp),
                )
                Text(
                    "Tick the apps you study with. During a Focus session they open from the flip phone's keypad; everything else stays locked.",
                    style = selawik(13, color = Wii.InkMuted),
                )
                SearchField(query) { query = it }

                Box(Modifier.weight(1f)) {
                    when {
                        apps == null -> Text("Loading apps…", style = selawik(13, color = Wii.InkMuted))
                        visible.isEmpty() -> Text("No apps match.", style = selawik(13, color = Wii.InkMuted))
                        else -> LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            items(visible, key = { it.packageName }) { app ->
                                val checked = app.packageName in selected
                                AppRow(app, checked) { ServiceLocator.whitelistStore.set(app.packageName, !checked) }
                            }
                        }
                    }
                }

                Row(Modifier.fillMaxWidth()) {
                    Spacer(Modifier.weight(1f))
                    Box(
                        Modifier
                            .height(42.dp)
                            .clip(RoundedCornerShape(50))
                            .background(Wii.CyanButton)
                            .border(2.dp, Wii.Cyan700, RoundedCornerShape(50))
                            .pressClick(onClick = onBack)
                            .padding(horizontal = 28.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("Done", style = selawik(16, FontWeight.SemiBold, Color.White))
                    }
                }
            }
        }
    }
}

/** A soft line under a heading, like the desktop's panel titles. */
private fun Modifier.underline(): Modifier = drawBehind {
    drawLine(Wii.LineSoft, Offset(0f, size.height), Offset(size.width, size.height), strokeWidth = 2.dp.toPx())
}

/** The desktop's text box: white, grey border, cyan ring while typing. */
@Composable
private fun SearchField(value: String, onChange: (String) -> Unit) {
    var focused by remember { mutableStateOf(false) }
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Color.White)
            .border(2.dp, if (focused) Wii.Cyan500 else Wii.Line, RoundedCornerShape(10.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
    ) {
        if (value.isEmpty()) Text("Search apps", style = selawik(15, color = Wii.InkMuted))
        BasicTextField(
            value = value,
            onValueChange = onChange,
            singleLine = true,
            textStyle = selawik(15),
            cursorBrush = SolidColor(Wii.Cyan700),
            modifier = Modifier.fillMaxWidth().onFocusChanged { focused = it.isFocused },
        )
    }
}

/** A row like the desktop's: white with a soft border, turning pale cyan once ticked. */
@Composable
private fun AppRow(app: InstalledApp, checked: Boolean, onToggle: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(if (checked) Wii.Cyan100 else Color.White)
            .border(2.dp, if (checked) Wii.Cyan300 else Wii.LineSoft, RoundedCornerShape(10.dp))
            .clickable(onClick = onToggle)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(20.dp)
                .clip(RoundedCornerShape(5.dp))
                .background(if (checked) Wii.Cyan500 else Color.White)
                .border(1.5.dp, if (checked) Wii.Cyan700 else Wii.Line, RoundedCornerShape(5.dp)),
            contentAlignment = Alignment.Center,
        ) {
            if (checked) Text("✓", style = selawik(13, FontWeight.Bold, Color.White))
        }
        Spacer(Modifier.width(12.dp))
        app.icon?.let {
            Image(it.asImageBitmap(), contentDescription = null, modifier = Modifier.size(32.dp))
            Spacer(Modifier.width(10.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(app.label, style = selawik(15, FontWeight.SemiBold), maxLines = 1)
            Text(app.packageName, style = selawik(12, color = Wii.InkMuted), maxLines = 1)
        }
    }
}
