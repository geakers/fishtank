# FocusFlip (Android)

Android companion for Fishtank, at `src/mobile`. It matches the iOS app (`src/ios`): the same
Frutiger Aero flip-phone UI in Selawik (the desktop's open Segoe UI stand-in), the same
committed focus sessions, and the same Supabase account (`profiles.minutes_studied` and
`profiles.points`, plus study groups).

> Status: **beta / test build**. Set `USE_MOCK_BACKEND = true` in
> `app/build.gradle.kts` only if you need an offline login for UI work.

## Features (matched to iOS)

- **Register / log in** once. The session is stored on the device.
- **Home screen in the desktop's style**: the Wii-white top bar (points pill, profile with stats, sync and log out), the flip phone on its stand where the desktop shows its tank, the big **Focus** button, **Study apps** (the whitelist) and **Focus Guard**, a study groups panel and the dock clock.
- **Committed sessions**: Focus first asks how long you commit to (presets of 15/25/45/60/90 minutes, or 1 to 240 with −/+). The phone stays locked for exactly that long and the session ends by itself.
- **Points only for finished commitments, same rules as the desktop** (`sessionEarnings` in `src/desktop/profiles.js`): a session that lasts its commitment adds its minutes to `profiles.minutes_studied` and earns points for the time committed to. Ending early with **END** still adds the minutes studied, but earns no points. `Points.TEST_POINT_PER_SECOND` mirrors the desktop's `TEST_POINT_PER_SECOND`; flip both together.
- **Flip phone lock screen**: LCD + keypad (soft keys, CALL/END, D-pad + OK, 0-9 / * / # with DTMF tones). The LCD counts down the time left and shows the points waiting at the end.
- **Study groups**: the same groups as the desktop. Create a group, accept or decline invites, see who is in each group, and (as its leader) invite people by username. Needs `src/database/study-groups.sql` and `study-group-invites.sql` in the database.
- Sessions are kept on the phone until they sync, and minutes and points are saved in one request.

## Keypad reference (lock screen)

| Key | Action |
|---|---|
| Up / Down | Move the selection |
| OK, CALL, left soft key | Open the selected app |
| Left / Right, right soft key | Switch between the **Apps** page and the big **Clock** page |
| END | End the session early (asks first; no points) |
| 1-9 | Jump to list entry N |
| `*` | Toggle the LCD backlight |
| `#` | Show a motivational tip |

## How the lock works

Android does not let a normal app fully take over the phone, so FocusFlip combines several layers:

1. **LockActivity**: a full-screen, immersive activity. The back button is swallowed, the screen stays on, and the activity is shown above the keyguard.
2. **Focus Guard (AccessibilityService)**: `focus/FocusGuardService.kt`. While a session runs, any window from an app that is *not* FocusFlip, a whitelisted app, the keyboard, or a critical system surface (emergency dialer, permission prompts) immediately brings LockActivity back. This covers the home screen, recents and settings. It also closes the notification shade on Android 12+. The service only reads the package name of the foreground window; it never reads screen content.
3. **FocusTimerService (foreground service)**: keeps the process alive, ends the session when its time is up and shows a countdown notification. State is stored as absolute timestamps, so it survives process death and reboots (`BootReceiver`).
4. **Optional kiosk mode (device owner)**: if the app is provisioned as device owner, sessions use Android *lock task mode*. The OS itself disables home, recents and the status bar, and only FocusFlip plus whitelisted apps can run. This is meant for dedicated or test devices:
   ```
   adb shell dpm set-device-owner com.focusflip.app/.focus.FocusDeviceAdminReceiver
   ```
   (The phone must have no accounts added. Use **Release device owner** in the profile sheet (test builds) before you uninstall.)

Without the accessibility guard *or* device owner, the timer still runs but other apps are not blocked. The home screen warns about this.

## Project structure

```
app/src/main/
├── java/com/focusflip/app/
│   ├── FocusFlipApp.kt              Application: wires ServiceLocator, notifications, session state
│   ├── di/ServiceLocator.kt         <- choose MOCK vs REAL backend here
│   ├── data/
│   │   ├── auth/                    Supabase auth, SessionStore (persistent login), mock
│   │   ├── sync/                    Points (the points rules), sync to profiles, offline queue, mock
│   │   ├── groups/                  Study groups (same calls as src/desktop/groups.js)
│   │   └── apps/                    InstalledApps (list/launch), WhitelistStore
│   ├── focus/
│   │   ├── FocusSessionManager.kt   IDLE -> FOCUS(committed minutes) -> IDLE
│   │   ├── FocusTimerService.kt     foreground countdown service
│   │   ├── FocusGuardService.kt     accessibility "lock"
│   │   ├── KioskMode.kt             optional device-owner lock task mode
│   │   ├── Notifications.kt
│   │   └── BootReceiver.kt
│   └── ui/
│       ├── MainActivity.kt          auth -> home -> study apps / study groups
│       ├── auth/  home/  whitelist/  groups/
│       ├── lock/                    LockActivity (full-screen host), FlipPhoneScreen (LCD + keypad)
│       └── theme/                   Wii.kt (desktop tokens, Selawik, theme), Retro.kt (flip phone, LCD)
└── res/font/                        Selawik (SIL OFL, see SELAWIK-LICENSE.txt)
```

## Backend

The app talks to the shared Fishtank Supabase project directly (`SupabaseAuthRepository`,
`RemoteSyncRepository`, `GroupsRepository`). Row level security on `profiles` and the study
group tables decides what each user may read and change. `USE_MOCK_BACKEND = true` swaps in
`MockAuthRepository` / `MockSyncRepository` (demo user `demo@focusflip.app` / `demo1234`);
study groups need the real database. For release builds, set `DEV_TOOLS = false`.

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
