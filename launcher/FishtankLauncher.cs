using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

// Starts the Fishtank desktop app. A second click brings the open window forward
// instead of launching another copy.
static class Program
{
    const int SW_RESTORE = 9;

    [DllImport("user32.dll")]
    static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern int MessageBox(IntPtr hWnd, string text, string caption, uint type);

    static int Main()
    {
        bool created;
        using (new Mutex(true, @"Local\FishtankLauncher", out created))
        {
            if (!created)
            {
                Focus();
                return 0;
            }
            if (Focus()) return 0;

            var root = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, ".."));
            if (!File.Exists(Path.Combine(root, "package.json")))
            {
                MessageBox(IntPtr.Zero, "找不到 Fishtank 项目。", "Fishtank", 0x10);
                return 1;
            }

            var npm = FindNpm();
            if (npm == null)
            {
                MessageBox(IntPtr.Zero, "找不到 npm。请先安装 Node.js，并把它加到 PATH。", "Fishtank", 0x10);
                return 1;
            }

            var start = new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = "/c \"" + npm + "\" run dev",
                WorkingDirectory = root,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            var process = Process.Start(start);
            process.WaitForExit();
            if (process.ExitCode != 0)
            {
                MessageBox(IntPtr.Zero, "Fishtank 没有启动成功。", "Fishtank", 0x10);
                return process.ExitCode;
            }
            return 0;
        }
    }

    static bool Focus()
    {
        foreach (var process in Process.GetProcessesByName("electron"))
        {
            if (process.MainWindowHandle == IntPtr.Zero) continue;
            if (process.MainWindowTitle.IndexOf("Fishtank", StringComparison.OrdinalIgnoreCase) < 0) continue;
            ShowWindow(process.MainWindowHandle, SW_RESTORE);
            SetForegroundWindow(process.MainWindowHandle);
            return true;
        }
        return false;
    }

    static string FindNpm()
    {
        var path = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (var dir in path.Split(';'))
        {
            if (dir.Trim().Length == 0) continue;
            var candidate = Path.Combine(dir.Trim(), "npm.cmd");
            if (File.Exists(candidate)) return candidate;
        }
        return null;
    }
}
