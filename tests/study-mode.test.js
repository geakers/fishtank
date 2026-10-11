const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseApp, parseAppList, isAllowed } = require('../src/desktop/study-mode');

// What `lsappinfo info -only name,bundleid,pid` prints for the app in front.
const FRONT = `"Safari" ASN:0x0-0x1b01b: (in front)
    bundleID="com.apple.Safari"
    pid = 812 !cgsConnection !signalled type=[ NULL ]  flavor=[ NULL ]
`;

// A cut-down `lsappinfo list`: a system helper, two ordinary apps and a
// background process with no bundle ID.
const LIST = ` 1) "loginwindow" ASN:0x0-0x1001:
    bundleID="com.apple.loginwindow"
    bundle path="/System/Library/CoreServices/loginwindow.app"
    pid = 603 token=[sess=100015 pid=603] type="UIElement" flavor=3 Version="3109"
 2) "Safari" ASN:0x0-0x1b01b:
    bundleID="com.apple.Safari"
    bundle path="/Applications/Safari.app"
    pid = 812 token=[sess=100015 pid=812] type="Foreground" flavor=3 Version="20"
 3) "universalaccessd" ASN:0x0-0x7007:
    bundleID=[ NULL ]
    bundle path="/usr/sbin/universalaccessd"
    pid = 915 token=[sess=100015 pid=915] !signalled type="BackgroundOnly" flavor=3
 4) "Notes" ASN:0x0-0x2c02c:
    bundleID="com.apple.Notes"
    bundle path="/System/Applications/Notes.app"
    pid = 1410 token=[sess=100015 pid=1410] type="Foreground" flavor=3 Version="4.11"
`;

test('parseApp reads the name, bundle ID and pid of the app in front', () => {
  assert.deepEqual(parseApp(FRONT), { id: 'com.apple.Safari', name: 'Safari', pid: 812, type: null });
});

test('parseApp falls back to the name for an app with no bundle ID', () => {
  const app = parseApp('"universalaccessd" ASN:0x0-0x7007:\n    bundleID=[ NULL ]\n    pid = 915 type="BackgroundOnly"\n');
  assert.equal(app.id, 'universalaccessd');
});

test('parseApp returns null when there is no app', () => {
  assert.equal(parseApp(''), null);
});

test('parseAppList keeps only ordinary apps, sorted by name', () => {
  assert.deepEqual(parseAppList(LIST), [
    { id: 'com.apple.Notes', name: 'Notes' },
    { id: 'com.apple.Safari', name: 'Safari' },
  ]);
});

test('isAllowed lets through study apps, system screens and Fishtank itself', () => {
  const allowed = [{ id: 'com.apple.Notes', name: 'Notes' }];

  assert.equal(isAllowed({ id: 'com.apple.Notes', name: 'Notes', pid: 1410 }, allowed), true);
  assert.equal(isAllowed({ id: 'com.apple.loginwindow', name: 'loginwindow', pid: 603 }, allowed), true);
  assert.equal(isAllowed({ id: 'com.github.Electron', name: 'Electron', pid: process.pid }, allowed), true);
  assert.equal(isAllowed({ id: 'com.apple.Safari', name: 'Safari', pid: 812 }, allowed), false);
});
