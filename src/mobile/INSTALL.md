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
2. **Register** with your name, email and password, or **Log in**.
   - Beta note: the server is not live yet. Accounts are saved only on this phone.
     You can tap the demo hint to fill in `demo@focusflip.app` / `demo1234`.
3. You stay logged in from now on. FocusFlip only asks again after you tap **LOG OUT**.
4. Allow **notifications** when asked. The focus countdown is shown there.

## 4. Turn on Focus Guard (required for the lock)

Focus Guard is what keeps you from leaving FocusFlip during a focus block.

1. On the home screen, tap the orange **"Focus Guard is OFF"** text (or go to Settings > Accessibility).
2. Open **Installed apps / Downloaded apps > FocusFlip Focus Guard** and turn it **On**. Confirm the dialog.
3. **Android 13 and newer**: if the switch is greyed out ("Restricted setting"):
   1. Go to Settings > Apps > FocusFlip.
   2. Tap the **three-dot menu (top right) > Allow restricted settings**, then confirm with your PIN or fingerprint.
   3. Go back to Accessibility and turn Focus Guard on.
4. Back in FocusFlip, the LCD should now show `GUARD  ON`.

Recommended: Settings > Apps > FocusFlip > Battery > **Unrestricted** (or "Don't optimize"). This stops
the system from killing the timer, which matters most on Xiaomi, Oppo, Vivo, Huawei and Samsung phones.

## 5. Set up your whitelist

1. On the home screen, tap **WHITELIST**.
2. Search for an app or scroll, and tap an app to check it `[X]`. Tap it again to uncheck it.
   Typical picks: Clock, Calculator, Notes, a dictionary, a music app.
3. Changes save instantly. Tap **< BACK**.

## 6. Start a focus session

1. Tap **START LOCK**. Your phone turns into a flip phone for **45 minutes**.
2. During focus:
   - Press **Up / Down** on the D-pad to highlight a whitelisted app, then press **OK** (or the green **CALL** key) to open it.
   - When you are done with that app, press back or home. You are taken straight back to the FocusFlip lock screen.
   - Press **Left / Right** (or the right soft key) to switch between the app list and the big clock. **END** jumps to the clock.
   - Keys **1-9** jump to that app in the list. `*` toggles the screen backlight. `#` shows a tip.
   - Home, recents, settings and non-whitelisted apps are blocked. Emergency calls still work.
3. After 45 minutes the **break** (15 minutes) starts and the phone is free to use. On the break screen,
   pick what happens next with Up/Down + OK:
   - **Continue focus**: the next 45-minute block starts automatically when the break ends.
   - **Exit session**: the session ends when the break ends.
4. Your completed blocks appear on the home screen as `TODAY ... MIN / ... BLOCKS`.

## 7. Sync with the desktop app

- Tap **SYNC NOW** on the home screen to upload your focus sessions and whitelist.
- Use the **same account** on the desktop app.
- Beta note: until the cloud server launches, sync is simulated and data stays on the phone.

## 8. Test build extras

- **DEV UNLOCK** (small red button at the bottom of the keypad) ends the session immediately.
  It exists only in the test build so you never get stuck.
- **Fast timers** (bottom of the home screen) shortens the cycle to 45 s focus / 15 s break,
  so you can try the full cycle quickly.

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| I can still open other apps during focus | Focus Guard is off. See step 4. |
| Focus Guard switch is greyed out | Allow restricted settings (step 4.3). |
| The timer stops when the screen is off | Set battery usage to Unrestricted (step 4). |
| A whitelisted app is not in the lock list | The app was uninstalled, or you checked it after the session started. Re-check it on the next session. |
| I'm stuck in the lock | Use **DEV UNLOCK** on the keypad (test build). |

## 10. Uninstall

Settings > Apps > FocusFlip > Uninstall. If you set FocusFlip up as device owner (advanced, see README),
tap **RELEASE DEVICE OWNER** on the home screen first.
