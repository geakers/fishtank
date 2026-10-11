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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.focusflip.app.data.apps.InstalledApp
import com.focusflip.app.data.apps.InstalledApps
import com.focusflip.app.di.ServiceLocator
import com.focusflip.app.ui.theme.LcdPanel
import com.focusflip.app.ui.theme.Retro
import com.focusflip.app.ui.theme.RetroLink
import com.focusflip.app.ui.theme.RetroScreen
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Pick which installed apps may be opened from the lock screen. Changes save immediately. */
@Composable
fun WhitelistScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val selected by ServiceLocator.whitelistStore.packages.collectAsStateWithLifecycle()
    var apps by remember { mutableStateOf<List<InstalledApp>?>(null) }
    var query by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        apps = withContext(Dispatchers.IO) { InstalledApps.load(context) }
    }

    val visible = apps.orEmpty().filter {
        query.isBlank() || it.label.contains(query, ignoreCase = true) || it.packageName.contains(query, ignoreCase = true)
    }

    RetroScreen(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                RetroLink("< BACK", onClick = onBack)
                Spacer(Modifier.weight(1f))
                Text("${selected.size} SELECTED", style = Retro.lcdText(13, bold = true, color = Retro.OnSky))
            }
            Spacer(Modifier.height(8.dp))
            LcdPanel(Modifier.fillMaxWidth()) {
                Text("WHITELIST", style = Retro.lcdText(22, bold = true))
                Text("Checked apps can be opened while locked.", style = Retro.lcdText(12))
                Spacer(Modifier.height(8.dp))
                Box(
                    Modifier
                        .fillMaxWidth()
                        .border(2.dp, Retro.LcdMid, RoundedCornerShape(4.dp))
                        .padding(horizontal = 10.dp, vertical = 8.dp)
                ) {
                    if (query.isEmpty()) Text("Search apps...", style = Retro.lcdText(14, color = Retro.LcdMid))
                    BasicTextField(
                        value = query,
                        onValueChange = { query = it },
                        singleLine = true,
                        textStyle = Retro.lcdText(14, bold = true),
                        cursorBrush = SolidColor(Retro.LcdInk),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
            Spacer(Modifier.height(12.dp))

            if (apps == null) {
                Text("LOADING APPS...", style = Retro.lcdText(14, bold = true, color = Retro.OnSky))
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(visible, key = { it.packageName }) { app ->
                        val checked = app.packageName in selected
                        AppRow(app, checked) {
                            ServiceLocator.whitelistStore.set(app.packageName, !checked)
                            scope.launch {
                                ServiceLocator.syncRepository.pushWhitelist(ServiceLocator.whitelistStore.packages.value)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AppRow(app: InstalledApp, checked: Boolean, onToggle: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(if (checked) Retro.Lcd else Retro.Glass)
            .border(1.dp, if (checked) Retro.LcdMid else Retro.GlassBorder, RoundedCornerShape(8.dp))
            .clickable(onClick = onToggle)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val ink = if (checked) Retro.LcdInk else Retro.OnSky
        app.icon?.let {
            Image(it.asImageBitmap(), contentDescription = null, modifier = Modifier.size(36.dp))
            Spacer(Modifier.width(12.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(app.label, style = Retro.lcdText(15, bold = true, color = ink), maxLines = 1)
            Text(app.packageName, style = Retro.lcdText(10, color = if (checked) Retro.LcdMid else Retro.OnSkyMuted), maxLines = 1)
        }
        Text(if (checked) "[X]" else "[ ]", style = Retro.lcdText(16, bold = true, color = ink))
    }
}
