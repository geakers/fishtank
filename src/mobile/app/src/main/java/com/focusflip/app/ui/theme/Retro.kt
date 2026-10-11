package com.focusflip.app.ui.theme

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Frutiger Aero palette: sky-to-grass backdrop, glossy pearl/aqua plastic,
 * a glowing aqua backlit LCD and glassy highlights. The flip phone shapes are unchanged.
 */
object Retro {
    // Backdrop
    val SkyTop = Color(0xFFBFEBFF)
    val SkyMid = Color(0xFF63C3F0)
    val GrassTop = Color(0xFF9EE37D)
    val GrassBottom = Color(0xFF3FA34D)

    /** Text and icons drawn directly on the backdrop. */
    val OnSky = Color(0xFF0B3D66)
    val OnSkyMuted = Color(0xFF2E6A93)
    /** Frosted-glass surfaces on the backdrop (unselected tabs / rows). */
    val Glass = Color(0x99FFFFFF)
    val GlassBorder = Color(0xCCFFFFFF)

    // Phone plastic (names kept from the metal theme; values are now pearl / aqua)
    val Background = Color(0xFF63C3F0)
    val ShellDark = Color(0xFF0A3557)
    val ShellMid = Color(0xFF3F86B5)
    val SilverLight = Color(0xFFFFFFFF)
    val Silver = Color(0xFFDDF2FC)
    val SilverDark = Color(0xFF8CC8E6)
    val KeyFace = Color(0xFFF7FCFF)
    val KeyFacePressed = Color(0xFFC6E8F8)
    val KeyText = Color(0xFF0B3D66)

    // Backlit aqua LCD
    val Lcd = Color(0xFFD2F5FF)
    val LcdLight = Color(0xFF93DDF7)
    val LcdDim = Color(0xFF7DB4C9)
    val LcdMid = Color(0xFF2C7FB0)
    val LcdInk = Color(0xFF053A5C)

    val CallGreen = Color(0xFF3CB64A)
    val EndRed = Color(0xFFE2474C)
    val Amber = Color(0xFFE07A00)

    val Pixel = FontFamily.Monospace

    val shellBrush = Brush.verticalGradient(listOf(SkyTop, SkyMid, GrassTop, GrassBottom))
    val silverBrush = Brush.verticalGradient(listOf(Color.White, Silver, SilverDark))

    fun lcdText(size: Int = 16, bold: Boolean = false, color: Color = LcdInk) = TextStyle(
        fontFamily = Pixel,
        fontSize = size.sp,
        fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal,
        color = color,
        letterSpacing = 0.5.sp,
    )
}

/** Faint horizontal lines over the LCD so it reads as a low-res dot-matrix screen. */
fun Modifier.scanlines(color: Color = Color(0x0F053A5C), step: Dp = 3.dp): Modifier = drawWithContent {
    drawContent()
    val px = step.toPx()
    var y = 0f
    while (y < size.height) {
        drawLine(color, Offset(0f, y), Offset(size.width, y), strokeWidth = 1f)
        y += px
    }
}

/** Aero glass shine: a white highlight fading out over the top part of the element. */
fun Modifier.gloss(fraction: Float = 0.5f, alpha: Float = 0.7f, corner: Dp = 0.dp): Modifier = drawWithContent {
    drawContent()
    val h = size.height * fraction
    drawRoundRect(
        brush = Brush.verticalGradient(
            listOf(Color.White.copy(alpha = alpha), Color.White.copy(alpha = 0.05f)),
            startY = 0f,
            endY = h,
        ),
        topLeft = Offset(size.width * 0.04f, size.height * 0.03f),
        size = Size(size.width * 0.92f, h),
        cornerRadius = CornerRadius(corner.toPx(), corner.toPx()),
    )
}

/** Glowing aqua backlit display in a glossy navy glass bezel. */
@Composable
fun LcdPanel(
    modifier: Modifier = Modifier,
    backlight: Boolean = true,
    contentPadding: Dp = 12.dp,
    fillHeight: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    Box(
        modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Brush.verticalGradient(listOf(Color(0xFF1C5F8C), Color(0xFF062A47))))
            .border(1.dp, Color(0x88FFFFFF), RoundedCornerShape(12.dp))
            .padding(6.dp)
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .then(if (fillHeight) Modifier.fillMaxHeight() else Modifier)
                .clip(RoundedCornerShape(6.dp))
                .background(
                    Brush.verticalGradient(
                        if (backlight) listOf(Retro.Lcd, Retro.LcdLight)
                        else listOf(Retro.LcdDim, Color(0xFF5A8FA5))
                    )
                )
                .scanlines()
                .gloss(fraction = 0.35f, alpha = 0.45f, corner = 6.dp)
                .padding(contentPadding),
            content = content,
        )
    }
}

/** Glossy Aero pill button. */
@Composable
fun RetroButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    accent: Color? = null,
    height: Dp = 64.dp,
    textSize: Int = 20,
    enabled: Boolean = true,
    subtitle: String? = null,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val face = when {
        !enabled -> listOf(Color(0xFFDDE7EE), Color(0xFFB9C9D4))
        pressed -> listOf(Retro.SilverDark, Retro.Silver)
        else -> listOf(Color.White, Retro.Silver, Retro.SilverDark)
    }
    Box(
        modifier
            .height(height)
            .clip(RoundedCornerShape(height / 2.6f))
            .background(Brush.verticalGradient(face))
            .border(BorderStroke(1.5.dp, Color.White), RoundedCornerShape(height / 2.6f))
            .gloss(fraction = 0.48f, alpha = 0.8f, corner = height / 3)
            .clickable(interactionSource = interaction, indication = null, enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (accent != null) {
                GlossyOrb(accent, 14.dp)
                Spacer(Modifier.width(12.dp))
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                androidx.compose.material3.Text(
                    text,
                    style = Retro.lcdText(textSize, bold = true, color = Retro.KeyText),
                )
                if (subtitle != null) {
                    androidx.compose.material3.Text(
                        subtitle,
                        style = Retro.lcdText(11, color = Retro.OnSkyMuted),
                    )
                }
            }
        }
    }
}

/** Small glossy colored bead, Aero-style. */
@Composable
fun GlossyOrb(color: Color, size: Dp) {
    Canvas(Modifier.width(size).height(size)) {
        val r = this.size.minDimension / 2
        drawCircle(Brush.radialGradient(listOf(color.copy(alpha = 0.75f), color), center = Offset(r, r * 1.3f), radius = r), r)
        drawCircle(Color.White.copy(alpha = 0.7f), r * 0.42f, Offset(r, r * 0.6f))
    }
}

/** Small text-only control, used for secondary actions. */
@Composable
fun RetroLink(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, color: Color = Retro.OnSky) {
    androidx.compose.material3.Text(
        text,
        style = Retro.lcdText(13, bold = true, color = color),
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Retro.Glass)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
    )
}

/** Translucent bubbles floating over the sky - the signature Frutiger Aero motif. */
@Composable
fun AeroBubbles(modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val bubbles = listOf(
            0.12f to 0.10f to 0.07f, 0.82f to 0.07f to 0.05f, 0.90f to 0.28f to 0.09f,
            0.06f to 0.42f to 0.05f, 0.70f to 0.55f to 0.04f, 0.20f to 0.70f to 0.08f,
            0.88f to 0.80f to 0.06f, 0.45f to 0.92f to 0.05f,
        )
        val w = size.width
        for ((pos, r) in bubbles) {
            val center = Offset(pos.first * w, pos.second * size.height)
            val radius = r * w
            drawCircle(
                Brush.radialGradient(
                    listOf(Color.White.copy(alpha = 0.05f), Color.White.copy(alpha = 0.35f)),
                    center = center,
                    radius = radius,
                ),
                radius,
                center,
            )
            drawCircle(Color.White.copy(alpha = 0.6f), radius, center, style = Stroke(1.5f))
            drawCircle(Color.White.copy(alpha = 0.75f), radius * 0.25f, Offset(center.x - radius * 0.38f, center.y - radius * 0.38f))
        }
    }
}

/** Sky-to-grass Aero backdrop with bubbles, shared by all screens. */
@Composable
fun RetroScreen(modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit) {
    Box(
        modifier
            .background(Retro.shellBrush)
            .fillMaxWidth(),
    ) {
        AeroBubbles(Modifier.fillMaxSize())
        content()
    }
}
