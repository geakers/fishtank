# FocusFlip (iOS)

iOS port of the Android FocusFlip app. Same Frutiger Aero flip-phone UI, the same
45 / 15 session machine, and the same Supabase account (`profiles.minutes_studied` and `profiles.points`).

> Status: **beta / test build**. Open `FocusFlip.xcodeproj` on a **Mac with Xcode 15+**.
> Windows cannot compile or install an iOS app.

## Features (matched to Android)

- **Register / log in** once. The session is stored on the device.
- **Aero home screen**: LCD panel with TOTAL / TODAY / WHITELIST / GUARD / SYNC, plus **START LOCK** and **WHITELIST**.
- **Flip phone lock screen**: LCD + keypad (soft keys, CALL/END, D-pad + OK, 0-9 / * / # with DTMF tones on the media volume session).
- **Break**: after 45 minutes, choose **Continue focus** or **Exit session**.
- **Desktop sync**: a finished 45-minute focus block adds 45 to `profiles.minutes_studied`.
- **UNLOCK** on the keypad ends the session and deducts 100 points (the balance may go negative).

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

## How the lock works on iOS

iOS does not allow an app to list every installed package or to pin itself on top
the way Android Accessibility + lock-task can. FocusFlip uses the closest equivalents:

1. **Full-screen FlipPhone** while a session is running. The home indicator and status bar are hidden. The screen stays on.
2. **Guided Access** (Settings → Accessibility → Guided Access) is the iOS “Focus Guard”. Triple-click the side button after START LOCK to freeze the phone on FocusFlip. Without it the timer still runs, but the user can leave the app.
3. **Bounce-back overlay**: if you leave FocusFlip during a focus block (Home / app switcher) and come back, the same aqua “PHONE LOCKED / TAP TO RETURN” panel as Android is shown.
4. **Whitelist**: iOS cannot enumerate installed apps. The list is a catalog of public URL schemes (Phone, Messages, Safari, Clock, YouTube, …). Ticked apps open via that scheme from the D-pad.

Use the **same email/password** as the Android and desktop apps so study time and points stay on one account.

## Build and install (Mac)

1. Install **Xcode** from the Mac App Store and open it once to accept the license.
2. Connect an iPhone (iOS 16+) and trust the computer, **or** pick an iOS Simulator.
3. Open `src/ios/FocusFlip.xcodeproj`.
4. In the target **Signing & Capabilities**, choose your Team (a free Apple ID works for personal devices).
5. Select the device / simulator and press Run (⌘R).
6. On a physical iPhone the first install is untrusted: **Settings → General → VPN & Device Management → Developer App → Trust**.
7. Enable **Guided Access**: Settings → Accessibility → Guided Access → On. Set a passcode. After START LOCK, triple-click the side button.

## Project structure

```
src/ios/
├── README.md
├── FocusFlip.xcodeproj
└── FocusFlip/
    ├── Config.swift              Supabase URL/key, 45/15 timers
    ├── Info.plist                URL schemes the whitelist can open
    ├── App/                      SwiftUI entry + AppModel (ServiceLocator)
    ├── Theme/                    Aero palette, LCD, buttons
    ├── Data/                     Auth, session, sync, whitelist catalog
    ├── Focus/                    45/15 machine, DTMF tones
    └── UI/                       Auth, Home, Whitelist, FlipPhone
```

The cloud project is the same as Android: `https://aakaelrvybduqijgermo.supabase.co`.
