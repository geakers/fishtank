package com.focusflip.app.ui.auth

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
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.focusflip.app.BuildConfig
import com.focusflip.app.data.auth.AuthResult
import com.focusflip.app.data.auth.MockAuthRepository
import com.focusflip.app.di.ServiceLocator
import com.focusflip.app.ui.theme.LcdPanel
import com.focusflip.app.ui.theme.LcdStatusBar
import com.focusflip.app.ui.theme.Retro
import com.focusflip.app.ui.theme.RetroButton
import com.focusflip.app.ui.theme.RetroScreen
import com.focusflip.app.ui.theme.gloss
import com.focusflip.app.ui.theme.rememberNow
import kotlinx.coroutines.launch

/** Login / register. On success the session is persisted, so this screen is shown only once. */
@Composable
fun AuthScreen() {
    var registerMode by rememberSaveable { mutableStateOf(false) }
    var name by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var confirm by rememberSaveable { mutableStateOf("") }
    var error by rememberSaveable { mutableStateOf<String?>(null) }
    var loading by rememberSaveable { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val now = rememberNow()

    fun submit() {
        error = validate(registerMode, name, email, password, confirm)
        if (error != null) return
        loading = true
        scope.launch {
            val repo = ServiceLocator.authRepository
            val result = if (registerMode) repo.register(name, email, password) else repo.login(email, password)
            loading = false
            if (result is AuthResult.Failure) error = result.message
            // On success SessionStore emits the new session and MainActivity switches to Home.
        }
    }

    RetroScreen(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Spacer(Modifier.height(12.dp))
            LcdPanel(Modifier.fillMaxWidth()) {
                LcdStatusBar(now)
                Spacer(Modifier.height(14.dp))
                Text("FOCUSFLIP", style = Retro.lcdText(30, bold = true))
                Text("Phone + desktop focus sync", style = Retro.lcdText(12))
                Spacer(Modifier.height(10.dp))
                Text(
                    if (registerMode) "> CREATE ACCOUNT" else "> SIGN IN",
                    style = Retro.lcdText(16, bold = true),
                )
            }

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ModeTab("LOGIN", !registerMode, Modifier.weight(1f)) { registerMode = false; error = null }
                ModeTab("REGISTER", registerMode, Modifier.weight(1f)) { registerMode = true; error = null }
            }

            if (registerMode) {
                RetroField("NAME", name, { name = it })
            }
            RetroField("EMAIL", email, { email = it }, keyboardType = KeyboardType.Email)
            RetroField("PASSWORD", password, { password = it }, isPassword = true)
            if (registerMode) {
                RetroField("CONFIRM PASSWORD", confirm, { confirm = it }, isPassword = true)
            }

            error?.let {
                Text("! $it", style = Retro.lcdText(13, bold = true, color = Retro.Amber))
            }

            RetroButton(
                text = when {
                    loading -> "CONNECTING..."
                    registerMode -> "CREATE ACCOUNT"
                    else -> "LOG IN"
                },
                onClick = { submit() },
                enabled = !loading,
                accent = Retro.CallGreen,
                modifier = Modifier.fillMaxWidth(),
            )

            if (BuildConfig.USE_MOCK_BACKEND) {
                Text(
                    "Offline mock backend. Demo account:\n" +
                        "${MockAuthRepository.DEMO_EMAIL} / ${MockAuthRepository.DEMO_PASSWORD}",
                    style = Retro.lcdText(12, color = Retro.OnSky),
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            registerMode = false
                            email = MockAuthRepository.DEMO_EMAIL
                            password = MockAuthRepository.DEMO_PASSWORD
                        },
                )
            }
        }
    }
}

private fun validate(register: Boolean, name: String, email: String, password: String, confirm: String): String? {
    if (register && name.isBlank()) return "Please enter your name."
    if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches()) return "Please enter a valid email."
    if (password.length < 6) return "Password must be at least 6 characters."
    if (register && password != confirm) return "Passwords do not match."
    return null
}

@Composable
private fun ModeTab(label: String, selected: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Box(
        modifier
            .height(40.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(if (selected) Retro.Lcd else Retro.Glass)
            .border(1.dp, if (selected) Retro.LcdMid else Retro.GlassBorder, RoundedCornerShape(8.dp))
            .gloss(fraction = 0.5f, alpha = 0.5f, corner = 8.dp)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, style = Retro.lcdText(14, bold = true, color = if (selected) Retro.LcdInk else Retro.OnSky))
    }
}

@Composable
private fun RetroField(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    isPassword: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    Column {
        Text(label, style = Retro.lcdText(11, bold = true, color = Retro.OnSky))
        Spacer(Modifier.height(4.dp))
        BasicTextField(
            value = value,
            onValueChange = onChange,
            singleLine = true,
            textStyle = Retro.lcdText(16, bold = true),
            cursorBrush = SolidColor(Retro.LcdInk),
            visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
            keyboardOptions = KeyboardOptions(
                keyboardType = if (isPassword) KeyboardType.Password else keyboardType,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(6.dp))
                .background(Retro.Lcd)
                .border(2.dp, Retro.LcdMid, RoundedCornerShape(6.dp))
                .padding(horizontal = 12.dp, vertical = 12.dp),
        )
    }
}
