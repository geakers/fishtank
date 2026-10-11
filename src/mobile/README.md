# FocusFlip (Android)

Android companion for Fishtank, living at `src/mobile` on the `mobile` branch.
It uses the same Supabase project as the desktop app (`src/database`, `src/db.js`).
Completed focus blocks add their duration to `profiles.focus_ms`
(see `src/database/profiles-focus-ms.sql`).

> Status: **beta / test build**. Set `USE_MOCK_BACKEND = true` in
> `app/build.gradle.kts` only if you need an offline login for UI work.

## Features

- **Register / log in** once. The session is stored on the device, so the next launches go straight to the home screen until you log out.
- **Retro home screen**: a silver flip phone look with a green LCD panel that shows today's stats, sync status and guard status. It has two main buttons:
  - **START LOCK**: starts a 45-minute focus block. The phone becomes a full-screen flip phone, and you cannot leave the app or open other apps.
  - **WHITELIST**: lists every installed app with a launcher icon. Check the apps that you are allowed to open while locked.
- **Flip phone lock screen**:
  - The top half is the LCD display: a countdown, a progress bar and the list of whitelisted apps.
  - The bottom half is the keypad: soft keys, CALL/END, a 4-way D-pad with a center OK key, and 0-9 / * / # with DTMF tones.
  - Use Up/Down to pick a whitelisted app and OK (or CALL) to open it. When you leave that app (back or home), you land back on the FocusFlip lock screen.
- **Break**: after 45 minutes you get a 15-minute break, and the phone is usable again. On the break screen you choose what happens when the break ends: **Continue focus** (the default, starts the next 45-minute block automatically) or **Exit session**.
- **Desktop sync**: every focus block (completed or aborted) is saved locally and pushed with **SYNC NOW**. Changes to the whitelist are mirrored too.
- **Dev tools** (test build only): a small red **DEV UNLOCK** button on the keypad ends the session at once. A **Fast timers** toggle on the home screen switches to 45 s focus / 15 s break.

## Keypad reference (lock screen)

| Key | Action |
|---|---|
| Up / Down | Move the selection |
| OK, CALL, left soft key | Open the selected app (focus) / choose an option (break) |
| Left / Right, right soft key | Switch between the **Apps** page and the big **Clock** page |
| END | Jump to the clock page |
| 1-9 | Jump to list entry N |
| `*` | Toggle the LCD backlight |
| `#` | Show a motivational tip |

## How the lock works

Android does not let a normal app fully take over the phone, so FocusFlip combines several layers:

1. **LockActivity**: a full-screen, immersive activity. The back button is swallowed during focus, the screen stays on, and the activity is shown above the keyguard.
2. **Focus Guard (AccessibilityService)**: `focus/FocusGuardService.kt`. While a focus block runs, any window from an app that is *not* FocusFlip, a whitelisted app, the keyboard, or a critical system surface (emergency dialer, permission prompts) immediately brings LockActivity back. This covers the home screen, recents and settings. It also closes the notification shade on Android 12+. The service only reads the package name of the foreground window; it never reads screen content.
3. **FocusTimerService (foreground service)**: keeps the process alive, ticks the state machine every second and shows a countdown notification. State is stored as absolute timestamps, so it survives process death and reboots (`BootReceiver`).
4. **Optional kiosk mode (device owner)**: if the app is provisioned as device owner, focus blocks use Android *lock task mode*. The OS itself disables home, recents and the status bar, and only FocusFlip plus whitelisted apps can run. This is meant for dedicated or test devices:
   ```
   adb shell dpm set-device-owner com.focusflip.app/.focus.FocusDeviceAdminReceiver
   ```
   (The phone must have no accounts added. Use **RELEASE DEVICE OWNER** in the dev tools on the home screen before you uninstall.)

Without the accessibility guard *or* device owner, the timer still runs but other apps are not blocked. The home screen warns about this.

## Project structure

```
app/src/main/java/com/focusflip/app/
├── FocusFlipApp.kt              Application: wires ServiceLocator, notifications, session state
├── di/ServiceLocator.kt         <- choose MOCK vs REAL backend here
├── data/
│   ├── auth/                    AuthRepository, SessionStore (persistent login),
│   │                            MockAuthRepository, RemoteAuthRepository (stub)
│   ├── sync/                    SyncRepository, LocalRecordStore (offline queue),
│   │                            MockSyncRepository, RemoteSyncRepository (stub)
│   └── apps/                    InstalledApps (list/launch), WhitelistStore
├── focus/
│   ├── FocusSessionManager.kt   IDLE -> FOCUS(45) -> BREAK(15) -> FOCUS | IDLE state machine
│   ├── FocusTimerService.kt     foreground countdown service
│   ├── FocusGuardService.kt     accessibility "lock"
│   ├── KioskMode.kt             optional device-owner lock task mode
│   ├── Notifications.kt
│   └── BootReceiver.kt
└── ui/
    ├── MainActivity.kt          auth -> home -> whitelist navigation
    ├── auth/AuthScreen.kt
    ├── home/HomeScreen.kt
    ├── whitelist/WhitelistScreen.kt
    ├── lock/LockActivity.kt     full-screen lock host
    ├── lock/FlipPhoneScreen.kt  LCD + keypad UI
    └── theme/                   retro palette, LCD widgets
```

## Backend integration

All backend access goes through two interfaces, so swapping the mock for the real API means changing only a few files:

| Interface | Mock (current) | Real (to implement) |
|---|---|---|
| `AuthRepository` | `MockAuthRepository`: accounts stored on the device, demo user `demo@focusflip.app` / `demo1234` | `RemoteAuthRepository` |
| `SyncRepository` | `MockSyncRepository`: fakes the upload and marks records as synced | `RemoteSyncRepository` |

Steps to go live:

1. Implement the `TODO(backend)` blocks in `RemoteAuthRepository.kt` and `RemoteSyncRepository.kt`.
2. In `app/build.gradle.kts`, set `API_BASE_URL` to the real server and set `USE_MOCK_BACKEND = false`.
3. Optional: move the token in `SessionStore` to EncryptedSharedPreferences or the Android Keystore, and add refresh tokens.
4. For release builds, set `DEV_TOOLS = false` to hide the dev unlock button and fast timers.

Expected API contract (please confirm with the desktop/backend team):

```
POST auth/login          { email, password }               -> { token, user: { id, email, displayName } }
POST auth/register       { displayName, email, password }  -> { token, user: { ... } }
POST auth/logout         (Bearer token)
POST sync/sessions       [ { id, startedAt, endedAt, plannedMinutes, completed } ] -> { acceptedIds: [...] }
GET  sync/sessions?since=<epochMs>                          -> [ records created on desktop ]
PUT  settings/whitelist  { packages: [ "com.example.app", ... ] }
```

Timestamps are epoch milliseconds (UTC). Record IDs are client-generated UUIDs, so uploads are idempotent.

## Building

Requirements: JDK 17+ and the Android SDK (platform 34, build-tools 34). Android Studio Koala or newer works out of the box.

```bash
# Windows
gradlew.bat assembleDebug        # app/build/outputs/apk/debug/app-debug.apk
gradlew.bat assembleRelease      # app/build/outputs/apk/release/app-release.apk (debug-signed beta)

# macOS / Linux
./gradlew assembleDebug
```

If the SDK is not found, create `local.properties` with `sdk.dir=<path to Android SDK>`.

UI screenshot tests (Paparazzi, runs on the JVM, no device needed):

```bash
gradlew.bat recordPaparazziDebug   # writes app/src/test/snapshots/images/*.png
gradlew.bat verifyPaparazziDebug   # fails if the UI changed
```

- Min SDK 26 (Android 8.0), target SDK 34 (Android 14).
- Kotlin 2.0, Jetpack Compose (Material 3), no third-party dependencies.

## Known limitations (beta)

- Without device owner, a determined user can still disable the accessibility service from Settings *before* a session, or reboot into safe mode. During a session, Settings itself is blocked by the guard.
- On Android 13+ sideloaded apps must be allowed to use "restricted settings" before the accessibility service can be turned on (see `INSTALL.md`).
- Some OEM ROMs (MIUI, ColorOS, EMUI, ...) kill background services aggressively. Disable battery optimization for FocusFlip.
- Whitelisted apps that open *other* apps (for example a browser link) are blocked unless the target app is whitelisted too.
