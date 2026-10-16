# Long-running helper for Windows study mode. Reads one command per line on
# stdin and writes one response (or a short block) per command on stdout.
# Kept alive so study mode can poll the foreground window without starting
# PowerShell every second. WatchPid is the app process; if it dies, this exits
# so a crashed Fishtank cannot leave the keyboard hook installed.
param([int]$WatchPid = 0)
$ErrorActionPreference = 'Continue'
$utf8 = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = $utf8
[Console]::InputEncoding = $utf8
$OutputEncoding = $utf8

function Write-Line([string]$text) {
  [Console]::Out.WriteLine($text)
  [Console]::Out.Flush()
}

try {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class FishWin {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);

  [StructLayout(LayoutKind.Sequential)]
  public struct WnfStateName {
    public uint Data0;
    public uint Data1;
  }

  [DllImport("ntdll.dll")]
  public static extern int NtQueryWnfStateData(
    ref WnfStateName StateName,
    IntPtr TypeId,
    IntPtr ExplicitScope,
    out uint ChangeStamp,
    byte[] Buffer,
    ref uint BufferSize);

  [DllImport("ntdll.dll")]
  public static extern int NtUpdateWnfStateData(
    ref WnfStateName StateName,
    byte[] Buffer,
    uint Length,
    IntPtr TypeId,
    IntPtr ExplicitScope,
    uint MatchingChangeStamp,
    uint CheckStamp);

  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, uint dwProcessId);

  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool CloseHandle(IntPtr hObject);

  static System.Threading.Timer parentTimer;

  // A PowerShell timer callback runs off the main runspace and was tearing
  // this process down. The check stays in C# so the helper can stay warm.
  public static void WatchParent(uint pid) {
    if (pid == 0 || parentTimer != null) return;
    parentTimer = new System.Threading.Timer(delegate(object state) {
      IntPtr handle = OpenProcess(0x1000, false, pid);
      if (handle != IntPtr.Zero) {
        CloseHandle(handle);
        return;
      }
      RestoreTaskbar();
      Environment.Exit(0);
    }, null, 1500, 1500);
  }

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern IntPtr FindWindow(string className, string windowName);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string className, string windowName);

  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

  static string TaskbarMark() {
    return System.IO.Path.Combine(System.IO.Path.GetTempPath(), "fishtank-taskbar-hidden");
  }

  // Hides or shows the taskbar on every monitor. A mark file is left while it
  // is hidden, so a crashed Fishtank can put it back the next time it starts.
  public static void SetTaskbarVisible(bool shown) {
    int command = shown ? 5 : 0;
    IntPtr primary = FindWindow("Shell_TrayWnd", null);
    if (primary != IntPtr.Zero) ShowWindow(primary, command);
    IntPtr child = IntPtr.Zero;
    while (true) {
      child = FindWindowEx(IntPtr.Zero, child, "Shell_SecondaryTrayWnd", null);
      if (child == IntPtr.Zero) break;
      ShowWindow(child, command);
    }
    string mark = TaskbarMark();
    if (shown) {
      if (System.IO.File.Exists(mark)) System.IO.File.Delete(mark);
    } else {
      System.IO.File.WriteAllText(mark, "1");
    }
  }

  public static void RestoreTaskbar() {
    if (!System.IO.File.Exists(TaskbarMark())) return;
    SetTaskbarVisible(true);
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsIconic(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowTextLength(IntPtr hWnd);

  [StructLayout(LayoutKind.Sequential)]
  public struct POINT {
    public int X;
    public int Y;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct WINDOWPLACEMENT {
    public int length;
    public int flags;
    public int showCmd;
    public POINT ptMinPosition;
    public POINT ptMaxPosition;
    public RECT rcNormalPosition;
  }

  [DllImport("user32.dll")]
  public static extern bool GetWindowPlacement(IntPtr hWnd, ref WINDOWPLACEMENT lpwndpl);

  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);

  static EnumProc enumProc;
  static uint enumPid;
  static IntPtr enumBest;
  static long enumBestArea;
  static bool enumTitled;

  // 0 when the window is missing or too small to be the app's own window.
  // A minimized window keeps the size it will restore to, not the tiny icon rect.
  public static long WindowArea(IntPtr hwnd) {
    if (hwnd == IntPtr.Zero) return 0;
    if (IsIconic(hwnd)) {
      WINDOWPLACEMENT place = new WINDOWPLACEMENT();
      place.length = System.Runtime.InteropServices.Marshal.SizeOf(typeof(WINDOWPLACEMENT));
      if (GetWindowPlacement(hwnd, ref place)) {
        long restoredWidth = place.rcNormalPosition.Right - place.rcNormalPosition.Left;
        long restoredHeight = place.rcNormalPosition.Bottom - place.rcNormalPosition.Top;
        if (restoredWidth >= 80 && restoredHeight >= 80) return restoredWidth * restoredHeight;
      }
      return 80L * 80L;
    }
    RECT rect;
    if (!IsWindowVisible(hwnd) || !GetWindowRect(hwnd, out rect)) return 0;
    long width = rect.Right - rect.Left;
    long height = rect.Bottom - rect.Top;
    if (width < 80 || height < 80) return 0;
    return width * height;
  }

  static bool EnumBest(IntPtr hwnd, IntPtr lParam) {
    uint pid;
    GetWindowThreadProcessId(hwnd, out pid);
    if (pid != enumPid) return true;
    long area = WindowArea(hwnd);
    if (area <= 0) return true;
    bool titled = GetWindowTextLength(hwnd) > 0;
    if (titled) {
      if (!enumTitled || area > enumBestArea) {
        enumTitled = true;
        enumBestArea = area;
        enumBest = hwnd;
      }
    } else if (!enumTitled && area > enumBestArea) {
      enumBestArea = area;
      enumBest = hwnd;
    }
    return true;
  }

  // The app's largest real window, including one that is minimized.
  public static IntPtr FindLargestWindow(uint pid) {
    enumPid = pid;
    enumBest = IntPtr.Zero;
    enumBestArea = 0;
    enumTitled = false;
    if (enumProc == null) enumProc = EnumBest;
    EnumWindows(enumProc, IntPtr.Zero);
    return enumBest;
  }
}
"@
} catch {
  Write-Line ("ERR`t" + $_.Exception.Message)
  exit 1
}

# Blocks the shortcuts that leave a Focus session: the Windows keys, Alt+Tab,
# Alt+Esc, Ctrl+Esc, Ctrl+Shift+Esc and Alt+F4. Ctrl+Alt+Del is handled by
# Windows itself and cannot be swallowed here. The hook lives on its own
# thread so this loop can keep reading commands.
$script:keyLockReady = $false
try {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Threading;

public static class KeyLock {
  const int WH_KEYBOARD_LL = 13;
  const int WM_KEYDOWN = 0x0100;
  const int WM_KEYUP = 0x0101;
  const int WM_SYSKEYDOWN = 0x0104;
  const int WM_SYSKEYUP = 0x0105;
  const int WM_QUIT = 0x0012;
  const int LLKHF_ALTDOWN = 0x20;

  const int VK_TAB = 0x09;
  const int VK_ESCAPE = 0x1B;
  const int VK_LWIN = 0x5B;
  const int VK_RWIN = 0x5C;
  const int VK_F4 = 0x73;
  const int VK_SHIFT = 0x10;
  const int VK_CONTROL = 0x11;
  const int VK_MENU = 0x12;

  delegate IntPtr HookProc(int nCode, IntPtr wParam, IntPtr lParam);

  [DllImport("user32.dll", SetLastError = true)]
  static extern IntPtr SetWindowsHookEx(int idHook, HookProc lpfn, IntPtr hMod, uint dwThreadId);

  [DllImport("user32.dll")]
  static extern bool UnhookWindowsHookEx(IntPtr hhk);

  [DllImport("user32.dll")]
  static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

  [DllImport("kernel32.dll", CharSet = CharSet.Auto)]
  static extern IntPtr GetModuleHandle(string lpModuleName);

  [DllImport("user32.dll")]
  static extern bool PeekMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax, uint wRemoveMsg);

  [DllImport("user32.dll")]
  static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

  [DllImport("user32.dll")]
  static extern bool TranslateMessage(ref MSG lpMsg);

  [DllImport("user32.dll")]
  static extern IntPtr DispatchMessage(ref MSG lpMsg);

  [DllImport("user32.dll")]
  static extern bool PostThreadMessage(uint idThread, uint Msg, IntPtr wParam, IntPtr lParam);

  [DllImport("kernel32.dll")]
  static extern uint GetCurrentThreadId();

  [DllImport("user32.dll")]
  static extern short GetAsyncKeyState(int vKey);

  [StructLayout(LayoutKind.Sequential)]
  struct KBDLLHOOKSTRUCT {
    public uint vkCode;
    public uint scanCode;
    public uint flags;
    public uint time;
    public IntPtr dwExtraInfo;
  }

  [StructLayout(LayoutKind.Sequential)]
  struct MSG {
    public IntPtr hwnd;
    public uint message;
    public IntPtr wParam;
    public IntPtr lParam;
    public uint time;
    public int ptX;
    public int ptY;
  }

  static IntPtr _hook = IntPtr.Zero;
  static HookProc _proc;
  static Thread _thread;
  static uint _threadId;
  static volatile bool _running;
  static readonly ManualResetEvent _ready = new ManualResetEvent(false);

  public static bool Start() {
    if (_running) return _hook != IntPtr.Zero;
    _running = true;
    _ready.Reset();
    _proc = HookCallback;
    _thread = new Thread(Loop);
    _thread.IsBackground = true;
    _thread.SetApartmentState(ApartmentState.STA);
    _thread.Start();
    if (!_ready.WaitOne(2000)) return false;
    return _hook != IntPtr.Zero;
  }

  public static void Stop() {
    _running = false;
    uint id = _threadId;
    if (id != 0) PostThreadMessage(id, WM_QUIT, IntPtr.Zero, IntPtr.Zero);
    Thread thread = _thread;
    if (thread != null) thread.Join(1000);
    _thread = null;
    if (_hook != IntPtr.Zero) {
      UnhookWindowsHookEx(_hook);
      _hook = IntPtr.Zero;
    }
  }

  static void Loop() {
    _threadId = GetCurrentThreadId();
    MSG peek;
    PeekMessage(out peek, IntPtr.Zero, WM_USER_UNUSED(), WM_USER_UNUSED(), 0);
    _hook = SetWindowsHookEx(WH_KEYBOARD_LL, _proc, GetModuleHandle(null), 0);
    _ready.Set();
    MSG msg;
    while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0) {
      TranslateMessage(ref msg);
      DispatchMessage(ref msg);
    }
    if (_hook != IntPtr.Zero) {
      UnhookWindowsHookEx(_hook);
      _hook = IntPtr.Zero;
    }
    _threadId = 0;
  }

  // A filter that matches nothing, so creating the queue does not drop a real message.
  static uint WM_USER_UNUSED() { return 0xFFFF; }

  static bool IsDown(int vk) {
    return (GetAsyncKeyState(vk) & 0x8000) != 0;
  }

  static bool ShouldBlock(KBDLLHOOKSTRUCT info) {
    uint vk = info.vkCode;
    if (vk == VK_LWIN || vk == VK_RWIN) return true;
    bool alt = (info.flags & LLKHF_ALTDOWN) != 0 || IsDown(VK_MENU);
    bool ctrl = IsDown(VK_CONTROL);
    bool shift = IsDown(VK_SHIFT);
    if (alt && (vk == VK_TAB || vk == VK_ESCAPE || vk == VK_F4)) return true;
    if (ctrl && vk == VK_ESCAPE) return true;
    if (ctrl && shift && vk == VK_ESCAPE) return true;
    return false;
  }

  static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
    if (nCode >= 0 && _running) {
      int msg = wParam.ToInt32();
      bool key = msg == WM_KEYDOWN || msg == WM_KEYUP || msg == WM_SYSKEYDOWN || msg == WM_SYSKEYUP;
      if (key) {
        KBDLLHOOKSTRUCT info = (KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(KBDLLHOOKSTRUCT));
        if (ShouldBlock(info)) return (IntPtr)1;
      }
    }
    return CallNextHookEx(_hook, nCode, wParam, lParam);
  }
}
'@
  $script:keyLockReady = $true
} catch {
  $script:keyLockReady = $false
}

# Tells Explorer to reload touchpad gesture settings. Registry writes alone sit
# in a cache until this runs, which is why a four-finger swipe would otherwise
# keep switching desktops.
$script:touchpadNotifyReady = $false
try {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class TouchpadCache {
  [ComImport]
  [Guid("6d5140c1-7436-11ce-8034-00aa006009fa")]
  [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IServiceProvider {
    [PreserveSig]
    int QueryService(ref Guid guidService, ref Guid riid, out IntPtr ppv);
  }

  [ComImport]
  [Guid("4214f6fa-eb36-4e2f-9ca2-23fdc1832df7")]
  [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IImmersiveSettingsCache {
    [PreserveSig]
    int OnSettingChanged(int settingId);
  }

  [DllImport("ole32.dll")]
  static extern int CoInitializeEx(IntPtr reserved, uint coInit);

  public static bool Apply(int[] ids) {
    CoInitializeEx(IntPtr.Zero, 0);
    Guid clsid = new Guid("c2f03a33-21f5-47fa-b4bb-156362a2f239");
    Type shellType = Type.GetTypeFromCLSID(clsid);
    if (shellType == null) return false;
    object shell = Activator.CreateInstance(shellType);
    IServiceProvider provider = shell as IServiceProvider;
    if (provider == null) return false;
    Guid sid = new Guid("53660488-8855-460b-a9ab-5cfc6b5012ca");
    Guid iid = new Guid("4214f6fa-eb36-4e2f-9ca2-23fdc1832df7");
    IntPtr unk;
    int hr = provider.QueryService(ref sid, ref iid, out unk);
    if (hr < 0 || unk == IntPtr.Zero) return false;
    object cacheObj = Marshal.GetObjectForIUnknown(unk);
    Marshal.Release(unk);
    IImmersiveSettingsCache cache = cacheObj as IImmersiveSettingsCache;
    if (cache == null) return false;
    foreach (int id in ids) cache.OnSettingChanged(id);
    Marshal.ReleaseComObject(cache);
    Marshal.ReleaseComObject(shell);
    return true;
  }
}
'@
  $script:touchpadNotifyReady = $true
} catch {
  $script:touchpadNotifyReady = $false
}

# If Fishtank is killed, exit so the keyboard hook dies with this process.
# Swipes are put back the next time the helper starts.
if ($WatchPid -gt 0) {
  [FishWin]::WatchParent([uint32]$WatchPid)
}

# Hex literals above 0x7FFFFFFF are negative Int32s in Windows PowerShell, and
# assigning those to UInt32 throws. Convert from text instead.
function ConvertTo-UInt32Hex([string]$hex) {
  return [Convert]::ToUInt32($hex, 16)
}

# Active Focus Assist / Do Not Disturb profile: 0 off, 1 priority, 2 alarms.
function New-ProfileState {
  $state = New-Object FishWin+WnfStateName
  $state.Data0 = ConvertTo-UInt32Hex 'A3BF1C75'
  $state.Data1 = ConvertTo-UInt32Hex '0D83063E'
  return $state
}

function Get-QuietLevel {
  $state = New-ProfileState
  $buf = New-Object byte[] 4
  $size = [uint32]4
  $stamp = [uint32]0
  $status = [FishWin]::NtQueryWnfStateData([ref]$state, [IntPtr]::Zero, [IntPtr]::Zero, [ref]$stamp, $buf, [ref]$size)
  return @{ status = $status; level = [int]$buf[0] }
}

# Writes the active profile: 0 off, 1 priority only, 2 alarms only.
# The older shell-mode state name is gone on current Windows 11.
function Set-QuietLevel([int]$level) {
  $state = New-ProfileState
  $buf = [byte[]]@([byte]$level, 0, 0, 0)
  return [FishWin]::NtUpdateWnfStateData([ref]$state, $buf, [uint32]4, [IntPtr]::Zero, [IntPtr]::Zero, [uint32]0, [uint32]0)
}

# Three- and four-finger swipes switch apps and desktops without a keypress.
# 0 means "do nothing". Missing values are the Windows defaults, so they are
# deleted again afterwards rather than written back as a number.
$script:gestureNames = @('ThreeFingerSlideEnabled', 'FourFingerSlideEnabled')
$script:gestureFile = Join-Path $env:TEMP 'fishtank-touchpad-gestures.txt'

function Read-GestureFile {
  if (-not (Test-Path $script:gestureFile)) { return $null }
  $map = @{}
  foreach ($line in Get-Content $script:gestureFile) {
    $eq = $line.IndexOf('=')
    if ($eq -lt 1) { continue }
    $name = $line.Substring(0, $eq)
    $value = $line.Substring($eq + 1)
    if ($value -eq '') { $map[$name] = $null } else { $map[$name] = [int]$value }
  }
  if ($map.Count -eq 0) { return $null }
  return $map
}

function Write-GestureFile($map) {
  $lines = @()
  foreach ($name in $script:gestureNames) {
    if ($null -eq $map[$name]) { $lines += ($name + '=') } else { $lines += ($name + '=' + $map[$name]) }
  }
  Set-Content -Path $script:gestureFile -Value $lines -Encoding ASCII
}

function Publish-TouchpadSettings {
  if (-not $script:touchpadNotifyReady) { return $false }
  # Slide-gesture ids for Windows 10, Windows 11 21H2, and 22H2 through 25H2.
  return [TouchpadCache]::Apply([int[]](0x0B, 0x0C, 0x10, 0x11, 0x12))
}

function Block-SwitchGestures {
  $path = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\PrecisionTouchPad'
  if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
  if (-not (Read-GestureFile)) {
    $saved = @{}
    foreach ($name in $script:gestureNames) {
      $prop = Get-ItemProperty -Path $path -Name $name -ErrorAction SilentlyContinue
      if ($prop) { $saved[$name] = [int]$prop.$name } else { $saved[$name] = $null }
    }
    Write-GestureFile $saved
  }
  foreach ($name in $script:gestureNames) {
    New-ItemProperty -Path $path -Name $name -PropertyType DWord -Value 0 -Force | Out-Null
  }
  return (Publish-TouchpadSettings)
}

function Restore-SwitchGestures {
  $saved = Read-GestureFile
  if (-not $saved) { return $true }
  $path = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\PrecisionTouchPad'
  if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
  foreach ($name in $script:gestureNames) {
    if (-not $saved.ContainsKey($name)) { continue }
    if ($null -eq $saved[$name]) {
      Remove-ItemProperty -Path $path -Name $name -ErrorAction SilentlyContinue
    } else {
      New-ItemProperty -Path $path -Name $name -PropertyType DWord -Value ([int]$saved[$name]) -Force | Out-Null
    }
  }
  Remove-Item -Path $script:gestureFile -ErrorAction SilentlyContinue
  return (Publish-TouchpadSettings)
}

function ConvertTo-AppName($proc) {
  $id = $proc.ProcessName.ToLowerInvariant()
  $name = $proc.ProcessName
  if ($id -eq 'explorer') { $name = 'File Explorer' }
  else {
    try {
      $desc = $proc.MainModule.FileVersionInfo.FileDescription
      if ($desc -and $desc.Trim()) { $name = $desc.Trim() }
    } catch {}
  }
  $name = ($name -replace "[`t`r`n]", ' ')
  $exe = ''
  try {
    if ($proc.MainModule -and $proc.MainModule.FileName) { $exe = $proc.MainModule.FileName }
  } catch {}
  $exe = ($exe -replace "[`t`r`n]", ' ')
  return @{ id = $id; name = $name; path = $exe }
}

# A previous Fishtank process may have died while swipes were off, or while
# the taskbar was held down for a study app.
Restore-SwitchGestures | Out-Null
[FishWin]::RestoreTaskbar()

Write-Line 'READY'

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $line = $line.Trim()
  if ($line -eq '') { continue }
  if ($line -eq 'exit') {
    if ($script:keyLockReady) { [KeyLock]::Stop() }
    Restore-SwitchGestures | Out-Null
    break
  }

  try {
    if ($line -eq 'front') {
      $hwnd = [FishWin]::GetForegroundWindow()
      $procId = [uint32]0
      [void][FishWin]::GetWindowThreadProcessId($hwnd, [ref]$procId)
      $proc = $null
      if ($procId -ne 0) { $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue }
      if (-not $proc) { Write-Line 'APP'; continue }
      $app = ConvertTo-AppName $proc
      Write-Line ("APP`t" + $app.id + "`t" + [int]$procId + "`t" + $app.name)
      continue
    }

    if ($line.StartsWith('list ')) {
      $own = 0
      [void][int]::TryParse($line.Substring(5).Trim(), [ref]$own)
      $seen = @{}
      Write-Line 'APPS'
      Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.Id -ne $own } | ForEach-Object {
        $app = ConvertTo-AppName $_
        if (-not $seen.ContainsKey($app.id)) {
          $seen[$app.id] = $true
          Write-Line ("ITEM`t" + $app.id + "`t" + $app.name + "`t" + $app.path)
        }
      }
      Write-Line 'APPS-END'
      continue
    }

    if ($line -eq 'ping') {
      Write-Line 'PONG'
      continue
    }

    # The largest real window of this app, including a minimized one. Activation
    # happens in Fishtank after the click is finished, so this must not touch it.
    if ($line.StartsWith('focus ')) {
      $id = $line.Substring(6).Trim().ToLowerInvariant()
      $found = $false
      $best = [IntPtr]::Zero
      $bestArea = [int64]0
      if ($id -ne '') {
        $seenPid = @{}
        foreach ($proc in Get-Process -ErrorAction SilentlyContinue) {
          try {
            if ($proc.ProcessName.ToLowerInvariant() -ne $id) { continue }
            $found = $true
            if ($seenPid.ContainsKey($proc.Id)) { continue }
            $seenPid[$proc.Id] = $true
            $handle = [FishWin]::FindLargestWindow([uint32]$proc.Id)
            if ($handle -eq [IntPtr]::Zero) { continue }
            $area = [FishWin]::WindowArea($handle)
            if ($area -gt $bestArea) {
              $bestArea = $area
              $best = $handle
            }
          } catch {}
        }
      }
      if ($best -ne [IntPtr]::Zero) { Write-Line ("FOCUS`thwnd`t" + $best.ToInt64()) }
      elseif ($found) { Write-Line "FOCUS`tbusy" }
      else { Write-Line "FOCUS`tmiss" }
      continue
    }

    if ($line -eq 'level') {
      $quiet = Get-QuietLevel
      Write-Line ("LEVEL`t" + $quiet.status + "`t" + $quiet.level)
      continue
    }

    if ($line -eq 'taskbar-off' -or $line -eq 'taskbar-on') {
      [FishWin]::SetTaskbarVisible($line -eq 'taskbar-on')
      Write-Line "TASKBAR`t1"
      continue
    }

    if ($line -eq 'keys-on' -or $line -eq 'keys-off') {
      $ok = $true
      if ($line -eq 'keys-on') {
        $hook = $script:keyLockReady -and [KeyLock]::Start()
        $swipes = Block-SwitchGestures
        $ok = $hook -or $swipes
      } else {
        if ($script:keyLockReady) { [KeyLock]::Stop() }
        Restore-SwitchGestures | Out-Null
      }
      Write-Line ("KEYS`t" + $(if ($ok) { '1' } else { '0' }))
      continue
    }

    if ($line -eq 'dnd-on' -or $line -eq 'dnd-off') {
      $before = Get-QuietLevel
      $status = $before.status
      $level = $before.level
      $owned = 0
      # Already on: leave the user's own setting alone. The state write is
      # synchronous, so there is nothing to wait for before reading it back.
      if ($line -eq 'dnd-on' -and $before.status -eq 0 -and $before.level -eq 0) {
        $status = Set-QuietLevel 2
        $after = Get-QuietLevel
        $level = $after.level
        if ($status -eq 0 -and $level -gt 0) { $owned = 1 }
      } elseif ($line -eq 'dnd-off') {
        $status = Set-QuietLevel 0
        $after = Get-QuietLevel
        $level = $after.level
      }
      Write-Line ("SET`t" + $status + "`t" + $level + "`t" + $owned)
      continue
    }

    Write-Line 'ERR	unknown command'
  } catch {
    Write-Line ("ERR`t" + $_.Exception.Message)
  }
}

if ($script:keyLockReady) { [KeyLock]::Stop() }
Restore-SwitchGestures | Out-Null
[FishWin]::RestoreTaskbar()
