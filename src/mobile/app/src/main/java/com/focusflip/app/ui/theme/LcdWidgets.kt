package com.focusflip.app.ui.theme

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Wall clock that recomposes once per second. */
@Composable
fun rememberNow(): Long {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            now = System.currentTimeMillis()
            delay(1_000L - now % 1_000L)
        }
    }
    return now
}

fun formatClock(epochMs: Long): String = SimpleDateFormat("HH:mm", Locale.US).format(Date(epochMs))

/** Account-wide focus time, e.g. "1H 05M" or "12 MIN". */
fun formatFocusTotal(ms: Long): String {
    val minutes = (ms / 60_000L).coerceAtLeast(0L)
    return if (minutes >= 60) "${minutes / 60}H ${minutes % 60}M" else "$minutes MIN"
}

fun formatCountdown(ms: Long): String {
    val total = (ms + 999) / 1000
    return "%02d:%02d".format(total / 60, total % 60)
}

/** Signal bars - carrier name - battery, the top row of every old phone. */
@Composable
fun LcdStatusBar(now: Long, carrier: String = "FOCUS-NET") {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Canvas(Modifier.size(width = 22.dp, height = 12.dp)) {
            val barW = size.width / 5
            for (i in 0 until 4) {
                val h = size.height * (i + 1) / 4f
                drawRect(Retro.LcdInk, Offset(i * barW * 1.3f, size.height - h), Size(barW, h))
            }
        }
        Spacer(Modifier.width(6.dp))
        Text(carrier, style = Retro.lcdText(11, bold = true))
        Spacer(Modifier.weight(1f))
        Text(formatClock(now), style = Retro.lcdText(12, bold = true))
        Spacer(Modifier.width(6.dp))
        Canvas(Modifier.size(width = 24.dp, height = 12.dp)) {
            val body = Size(size.width - 3.dp.toPx(), size.height)
            drawRect(Retro.LcdInk, Offset.Zero, body, style = Stroke(1.5.dp.toPx()))
            drawRect(Retro.LcdInk, Offset(body.width, size.height * 0.3f), Size(3.dp.toPx(), size.height * 0.4f))
            val cell = (body.width - 4.dp.toPx()) / 3
            for (i in 0 until 3) {
                drawRect(
                    Retro.LcdInk,
                    Offset(2.dp.toPx() + i * cell + 1, 2.dp.toPx()),
                    Size(cell - 2, body.height - 4.dp.toPx()),
                )
            }
        }
    }
}

/** Segmented pixel progress bar. [progress] in 0..1. */
@Composable
fun LcdProgress(progress: Float, modifier: Modifier = Modifier, segments: Int = 20) {
    Canvas(modifier.fillMaxWidth().height(10.dp)) {
        val gap = 2.dp.toPx()
        val w = (size.width - gap * (segments - 1)) / segments
        val filled = (progress.coerceIn(0f, 1f) * segments).toInt()
        for (i in 0 until segments) {
            val x = i * (w + gap)
            if (i < filled) {
                drawRect(Retro.LcdInk, Offset(x, 0f), Size(w, size.height))
            } else {
                drawRect(Retro.LcdMid, Offset(x, 0f), Size(w, size.height), style = Stroke(1f))
            }
        }
    }
}
