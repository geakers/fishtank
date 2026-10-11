package com.focusflip.app.ui.theme

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.focusflip.app.R
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToLong

/**
 * Selawik (res/font), the open stand-in for Segoe UI that the desktop app uses, so the phone
 * has the same Frutiger Aero type. Licensed under the SIL OFL (SELAWIK-LICENSE.txt).
 */
val Selawik = FontFamily(
    Font(R.font.selawik_light, FontWeight.Light),
    Font(R.font.selawik_regular, FontWeight.Normal),
    Font(R.font.selawik_semibold, FontWeight.SemiBold),
    Font(R.font.selawik_bold, FontWeight.Bold),
)

/** Text in Selawik, the default ink being the desktop's. */
fun selawik(size: Int, weight: FontWeight = FontWeight.Normal, color: Color = Wii.Ink) = TextStyle(
    fontFamily = Selawik,
    fontSize = size.sp,
    fontWeight = weight,
    color = color,
)

/**
 * Selawik for every Material text too (dialogs, sheets, plain Text), and the desktop's cyan
 * for their buttons. Wraps every screen.
 */
@Composable
fun FocusFlipTheme(content: @Composable () -> Unit) {
    val base = Typography()
    fun TextStyle.inSelawik() = copy(fontFamily = Selawik)
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Wii.Cyan700,
            secondary = Wii.Cyan500,
            surface = Wii.Surface,
            surfaceContainerHigh = Wii.Surface,
            onSurface = Wii.Ink,
            onSurfaceVariant = Wii.InkMuted,
            error = Wii.Danger,
        ),
        typography = Typography(
            displayLarge = base.displayLarge.inSelawik(),
            displayMedium = base.displayMedium.inSelawik(),
            displaySmall = base.displaySmall.inSelawik(),
            headlineLarge = base.headlineLarge.inSelawik(),
            headlineMedium = base.headlineMedium.inSelawik(),
            headlineSmall = base.headlineSmall.inSelawik(),
            titleLarge = base.titleLarge.inSelawik(),
            titleMedium = base.titleMedium.inSelawik(),
            titleSmall = base.titleSmall.inSelawik(),
            bodyLarge = base.bodyLarge.inSelawik(),
            bodyMedium = base.bodyMedium.inSelawik(),
            bodySmall = base.bodySmall.inSelawik(),
            labelLarge = base.labelLarge.inSelawik(),
            labelMedium = base.labelMedium.inSelawik(),
            labelSmall = base.labelSmall.inSelawik(),
        ),
        content = content,
    )
}

/**
 * The desktop app's "water Wii" tokens (src/frontend/theme/tokens.css), so screens that
 * mirror the desktop look the same: Wii whites and greys, cyan, and backlit water.
 * Kept the same as Wii in the iOS app's Palette.swift.
 */
object Wii {
    val Surface = Color(0xFFF7F9FB)
    val SurfaceSunk = Color(0xFFE9EEF2)
    val Line = Color(0xFFC9D1D8)
    val LineSoft = Color(0xFFDDE3E8)
    val Ink = Color(0xFF3C4650)
    val InkMuted = Color(0xFF8A959F)
    val Cyan100 = Color(0xFFDFF5FD)
    val Cyan300 = Color(0xFF8EDCF7)
    val Cyan500 = Color(0xFF34BEED)
    val Cyan700 = Color(0xFF0D97CF)
    val Grass600 = Color(0xFF4AA52A)
    val Danger = Color(0xFFE2484D)
    val DockTime = Color(0xFF9BA5AE)
    val Shadow = Color(0xFF283C50)

    val Backdrop = Brush.verticalGradient(
        0f to Color(0xFFFDFEFF), 0.6f to Color(0xFFEEF2F5), 1f to Color(0xFFE2E8ED),
    )
    /** The white-to-grey glossy face of pills and buttons, with the hard split in the middle. */
    val Button = Brush.verticalGradient(
        0f to Color.White, 0.5f to Color(0xFFF3F6F8), 0.51f to Color(0xFFE6EBEF), 1f to Color(0xFFF2F5F7),
    )
    val Tile = Brush.verticalGradient(listOf(Color.White, Color(0xFFF6F8FA), Color(0xFFEDF1F4)))
    val Metal = Brush.verticalGradient(
        0f to Color(0xFFFBFCFD), 0.48f to Color(0xFFD9DFE4), 0.52f to Color(0xFFA9B3BB), 1f to Color(0xFFD9DFE4),
    )
    val Dock = Brush.verticalGradient(listOf(Color(0xFFF4F7F9), Color(0xFFE3E9ED)))
    /** The cyan Done button. */
    val CyanButton = Brush.verticalGradient(
        0f to Color(0xFF8FE2FF), 0.5f to Cyan500, 0.51f to Color(0xFF13A7E0), 1f to Color(0xFF4CC8F2),
    )
}

private val Capsule = RoundedCornerShape(50)

/** The desktop's backdrop: white fading to grey, with faint Wii pinstripes. */
@Composable
fun WiiBackdrop(modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit = {}) {
    Box(
        modifier
            .fillMaxSize()
            .background(Wii.Backdrop)
            .drawBehind {
                val step = 5.dp.toPx()
                var y = 0f
                while (y < size.height) {
                    drawRect(Color(0x093C4650), Offset(0f, y), Size(size.width, 1.dp.toPx()))
                    y += step
                }
            },
        content = content,
    )
}

/** The glossy white pill the desktop uses for its badge, profile and glass buttons. */
fun Modifier.wiiPill(border: Color = Wii.Line, shape: Shape = Capsule): Modifier = this
    .shadow(3.dp, shape, ambientColor = Wii.Shadow, spotColor = Wii.Shadow)
    .clip(shape)
    .background(Wii.Button)
    .border(2.dp, border, shape)

/** A white tile with a soft border and shadow, like the desktop's panels. */
fun Modifier.wiiTile(corner: Dp = 24.dp): Modifier {
    val shape = RoundedCornerShape(corner)
    return this
        .shadow(8.dp, shape, ambientColor = Wii.Shadow, spotColor = Wii.Shadow)
        .clip(shape)
        .background(Wii.Tile)
        .border(2.dp, Wii.LineSoft, shape)
}

/** Clickable, shrinking a little while pressed like the desktop's buttons. */
@Composable
fun Modifier.pressClick(enabled: Boolean = true, onClick: () -> Unit): Modifier {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.96f else 1f, tween(120), label = "press")
    return this
        .graphicsLayer { scaleX = scale; scaleY = scale }
        .clickable(interactionSource = source, indication = null, enabled = enabled, onClick = onClick)
}

/** The cyan orb with a white ring used for the brand and the point coin. */
@Composable
fun Orb(size: Dp) {
    Canvas(Modifier.size(size)) {
        val r = this.size.minDimension / 2
        drawCircle(
            Brush.radialGradient(
                listOf(Color(0xFFD6F6FF), Wii.Cyan500, Wii.Cyan700),
                center = Offset(r * 0.7f, r * 0.6f),
                radius = r * 1.1f,
            ),
            r,
        )
        drawCircle(Color.White, r - r * 0.11f, style = Stroke(r * 0.22f))
        drawCircle(Wii.Cyan700, r - 0.5.dp.toPx(), style = Stroke(1.dp.toPx()))
    }
}

/** A round avatar with the name's first letter, as on the desktop. */
@Composable
fun Avatar(name: String, size: Dp) {
    Box(
        Modifier
            .size(size)
            .clip(CircleShape)
            .background(Brush.verticalGradient(listOf(Wii.Cyan100, Wii.Cyan300)))
            .border(2.dp, Color.White, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            name.take(1).uppercase(),
            style = selawik((size.value * 0.45f).toInt(), FontWeight.SemiBold, Color.White),
        )
    }
}

/** The desktop's big Focus pill: white glass, cyan ring, a soft pulsing glow. */
@Composable
fun HeroButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val pulse = rememberInfiniteTransition(label = "glow")
    val glow by pulse.animateFloat(0f, 1f, infiniteRepeatable(tween(1_200), RepeatMode.Reverse), label = "glow")
    Box(
        modifier
            .fillMaxWidth()
            .height(72.dp)
            .drawBehind {
                val grow = (4 + 6 * glow).dp.toPx()
                drawRoundRect(
                    Wii.Cyan500.copy(alpha = 0.12f + 0.1f * glow),
                    topLeft = Offset(-grow, -grow),
                    size = Size(size.width + 2 * grow, size.height + 2 * grow),
                    cornerRadius = CornerRadius(size.height / 2 + grow),
                )
            }
            .shadow(12.dp, Capsule, ambientColor = Wii.Shadow, spotColor = Wii.Shadow)
            .clip(Capsule)
            .background(Wii.Button)
            .border(3.dp, Wii.Cyan500, Capsule)
            .pressClick(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, style = selawik(30, FontWeight.SemiBold, Wii.Cyan700).copy(letterSpacing = 1.2.sp))
    }
}

/** The desktop's glass buttons (Study apps, Strict lock-in). */
@Composable
fun WiiButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    detail: String? = null,
    warn: Boolean = false,
) {
    Row(
        modifier
            .height(42.dp)
            .wiiPill()
            .pressClick(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = androidx.compose.foundation.layout.Arrangement.Center,
    ) {
        Text(text, style = selawik(15, FontWeight.SemiBold))
        if (detail != null) {
            Spacer(Modifier.width(6.dp))
            Text(detail, style = selawik(12, FontWeight.Bold, if (warn) Wii.Danger else Wii.Cyan700))
        }
    }
}

/** A running session's time: MM:SS, or H:MM:SS from the first hour on. */
fun formatElapsed(seconds: Int): String {
    val h = seconds / 3600
    val m = seconds / 60 % 60
    val s = seconds % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%02d:%02d".format(m, s)
}

/** Points without a needless ".00". */
fun formatPoints(points: Double): String {
    val rounded = points.roundToLong()
    return if (abs(points - rounded) < 0.001) rounded.toString() else "%.2f".format(points)
}

/** Points with thousands separators, like the desktop badge (100,000). */
fun formatPointsGrouped(points: Double): String {
    val f = NumberFormat.getNumberInstance(Locale.getDefault())
    f.maximumFractionDigits = if (abs(points - points.roundToLong()) < 0.001) 0 else 2
    return f.format(points)
}
