# FocusFlip (iOS)

iOS twin of the Android FocusFlip app. Same Frutiger Aero flip-phone UI in Selawik (the
desktop's open Segoe UI stand-in, bundled in `FocusFlip/Fonts`), the same committed focus
sessions as the desktop, and the same Supabase account (`profiles.minutes_studied` and `profiles.points`).

> Status: **beta / test build**. Open `FocusFlip.xcodeproj` on a **Mac with Xcode 15+**.
> Windows cannot compile or install an iOS app.

## Features (matched to Android)

- **Register / log in** once. The session is stored on the device.
- **Home screen in the desktop's style**: the same Wii-white top bar (points pill, profile with stats, sync and log out), the flip phone on its stand where the desktop shows its tank, the big **Focus** button, **Study apps** (the whitelist) and **Focus Guard**, a study groups panel and the dock clock.
- **Flip phone lock screen**: LCD + keypad (soft keys, CALL/END, D-pad + OK, 0-9 / * / # with DTMF tones on the media volume session).
- **Committed sessions**: Focus first asks how long you commit to (presets of 15/25/45/60/90 minutes, or 1 to 240 with −/+). The LCD counts down from there and the session ends by itself when the time is up.
- **Points only for finished commitments, same rules as the desktop** (`sessionEarnings` in `src/desktop/profiles.js`): a session that lasts its commitment adds its minutes to `profiles.minutes_studied` and earns points for the time committed to. Sessions are kept on the phone until they sync, and minutes and points are saved in one request. `Config.testPointPerSecond` mirrors the desktop's `TEST_POINT_PER_SECOND`; flip both together.
- The red **END** key ends the session early, after asking. The time focused still counts toward study time, but earns no points.
- **Study groups**: the same groups as the desktop. Create a group, accept or decline invites, see who is in each group, and (as its leader) invite people by username. Needs `src/database/study-groups.sql` and `study-group-invites.sql` in the database.

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

## How the lock works on iOS

**Focus Guard** uses Apple's Screen Time API (FamilyControls, ManagedSettings and DeviceActivity):

1. The first time, FocusFlip asks for Screen Time permission (Focus Guard on the home screen, or when you start a session).
2. Under **Study apps → Allowed during Focus**, Apple's picker chooses the apps and websites that stay open. Pick apps one by one; a whole category can't be allowed.
3. When a session starts, every other app and website shows Screen Time's block screen until the session ends.
4. When the session ends, in the app or because time ran out, the block comes off. The **FocusFlipMonitor** extension (`FocusFlipMonitor/`) also takes it off at the end time even if FocusFlip isn't running. Schedules have a 15-minute minimum, so shorter sessions end on the schedule's warning instead.
5. **Keypad shortcuts**: iOS cannot list installed apps, so the flip phone opens apps from a catalog of public URL schemes (Phone, Messages, Safari, Clock, YouTube, ...). A shortcut only opens during a session if that app is also allowed.

Without Screen Time permission the timer still runs, and leaving FocusFlip shows the "PHONE LOCKED / TAP TO RETURN" panel when you come back, but nothing is blocked.

Use the **same email/password** as the Android and desktop apps so study time and points stay on one account.

### Turning Focus Guard on

Focus Guard is **off in the build** for now, because the Screen Time capability (Family Controls) needs a paid Apple Developer account and free accounts can't sign it. The app still runs: Focus Guard shows "Off" and nothing is blocked.

With a paid account, in Xcode's **Signing & Capabilities** pick the paid team for both targets, then set **Code Signing Entitlements** (`CODE_SIGN_ENTITLEMENTS`) to `FocusFlip/FocusFlip.entitlements` on the FocusFlip target and `FocusFlipMonitor/FocusFlipMonitor.entitlements` on the FocusFlipMonitor target. TestFlight and App Store builds also need Apple to approve the Family Controls (Distribution) entitlement.

## Build and install (Mac)

1. Install **Xcode** from the Mac App Store and open it once to accept the license.
2. Connect an iPhone (iOS 16+) and trust the computer, **or** pick an iOS Simulator.
3. Open `src/ios/FocusFlip.xcodeproj`.
4. In **Signing & Capabilities**, choose your Team for both the **FocusFlip** and **FocusFlipMonitor** targets. A free Apple ID works.
5. Select the device / simulator and press Run (⌘R).
6. On a physical iPhone the first install is untrusted: **Settings → General → VPN & Device Management → Developer App → Trust**.

## Project structure

```
src/ios/
├── README.md
├── FocusFlip.xcodeproj
└── FocusFlip/
    ├── Config.swift              Supabase URL/key, points and commitment rules
    ├── Fonts/                    Selawik (SIL OFL, see Fonts/LICENSE.txt)
    ├── Info.plist                URL schemes the whitelist can open
    ├── App/                      SwiftUI entry + AppModel (ServiceLocator)
    ├── Theme/                    Aero palette, LCD, buttons
    ├── Data/                     Auth, session, sync, study groups, whitelist catalog
    ├── Focus/                    Committed session, Focus Guard (Screen Time), DTMF tones
    └── UI/                       Auth, Home, Whitelist, Study groups, FlipPhone
└── FocusFlipMonitor/             Extension that unblocks apps when a session's time is up
```

The cloud project is the same as Android: `https://aakaelrvybduqijgermo.supabase.co`.
