# FocusFlip - Download & User Guide

## 1. Download

FocusFlip is in beta and is not on Google Play yet. Install it from the APK file:

- Ready-made APK: `release/FocusFlip-0.1.0-beta.apk` in this project
  (or build it yourself, see `README.md` > Building).
- Requires **Android 8.0 or newer**.

## 2. Install on your phone

**Option A - copy the file**

1. Copy `FocusFlip-0.1.0-beta.apk` to the phone (USB cable, cloud drive, chat app, email...).
2. Open it with the phone's **Files** app.
3. If Android says the source is not allowed, tap **Settings** and turn on **Allow from this source**. Go back and tap **Install**.
4. If Google Play Protect warns about an unknown app, tap **More details > Install anyway**. This happens because the beta is not signed through Play.

**Option B - with a computer (adb)**

1. On the phone, enable **Developer options** (Settings > About phone > tap *Build number* 7 times). Then turn on **USB debugging**.
2. Connect the phone and run:
   ```
   adb install -r FocusFlip-0.1.0-beta.apk
   ```

## 3. First launch

1. Open **FocusFlip**.
2. **Register** with your name, email and password, or **Log in** with the account you use on the desktop app.
3. You stay logged in from now on. FocusFlip only asks again after you log out (tap your name at the top right).
4. Allow **notifications** when asked. The focus countdown is shown there.

## 4. Turn on Focus Guard (required for the lock)

Focus Guard is what keeps you from leaving FocusFlip during a focus session.

1. On the home screen, tap **Focus Guard** (it shows **Off** in red), or go to Settings > Accessibility.
2. Open **Installed apps / Downloaded apps > FocusFlip Focus Guard** and turn it **On**. Confirm the dialog.
3. **Android 13 and newer**: if the switch is greyed out ("Restricted setting"):
   1. Go to Settings > Apps > FocusFlip.
   2. Tap the **three-dot menu (top right) > Allow restricted settings**, then confirm with your PIN or fingerprint.
   3. Go back to Accessibility and turn Focus Guard on.
4. Back in FocusFlip, the **Focus Guard** button on the home screen should now say **On**.

Recommended: Settings > Apps > FocusFlip > Battery > **Unrestricted** (or "Don't optimize"). This stops
the system from killing the timer, which matters most on Xiaomi, Oppo, Vivo, Huawei and Samsung phones.

## 5. Set up your study apps

1. On the home screen, tap **Study apps**.
2. Search for an app or scroll, and tap an app to tick it. Tap it again to untick it.
   Typical picks: Clock, Calculator, Notes, a dictionary, a music app.
3. Changes save instantly. Tap **Done**.

## 6. Start a focus session

1. Tap **Focus** (or the flip phone). Choose how long you commit to: 15, 25, 45, 60 or 90 minutes,
   or use **−** / **+** for anything from 1 to 240 minutes. Tap **Start**.
2. Your phone turns into a flip phone until the time is up:
   - Press **Up / Down** on the D-pad to highlight a study app, then press **OK** (or the green **CALL** key) to open it.
   - When you are done with that app, press back or home. You are taken straight back to the FocusFlip lock screen.
   - Press **Left / Right** (or the right soft key) to switch between the app list and the big clock.
   - Keys **1-9** jump to that app in the list. `*` toggles the screen backlight. `#` shows a tip.
   - Home, recents, settings and other apps are blocked. Emergency calls still work.
3. When the time is up the session ends by itself and you earn your points.
4. The red **END** key ends the session early, after asking. Your study time still counts,
   but **you only earn points if you stay for the whole time you committed to**.

## 7. Sync with the desktop app

- Sessions are added to your account automatically. To retry after being offline, tap your name
  at the top right, then **Sync now**.
- Use the **same account** on the desktop and iOS apps; study time, points and study groups are shared.

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| I can still open other apps during focus | Focus Guard is off. See step 4. |
| Focus Guard switch is greyed out | Allow restricted settings (step 4.3). |
| The timer stops when the screen is off | Set battery usage to Unrestricted (step 4). |
| A study app is not in the lock list | The app was uninstalled, or you ticked it after the session started. It shows up next session. |
| I'm stuck in the lock | Press **END** and confirm. You keep your study time but earn no points. |

## 9. Uninstall

Settings > Apps > FocusFlip > Uninstall. If you set FocusFlip up as device owner (advanced, see README),
tap your name at the top right, then **Release device owner** first.
