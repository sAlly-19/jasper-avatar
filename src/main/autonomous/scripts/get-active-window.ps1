Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class ActiveWinFinder {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@ -ErrorAction SilentlyContinue

$hwnd = [ActiveWinFinder]::GetForegroundWindow()
$targetProcId = 0
[void][ActiveWinFinder]::GetWindowThreadProcessId($hwnd, [ref]$targetProcId)

$sb = New-Object System.Text.StringBuilder 256
[void][ActiveWinFinder]::GetWindowText($hwnd, $sb, 256)
$title = $sb.ToString()

$proc = Get-Process -Id $targetProcId -ErrorAction SilentlyContinue
$procName = if ($proc) { $proc.ProcessName } else { "Unknown" }

[PSCustomObject]@{
    processName = $procName
    windowTitle = $title
    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
} | ConvertTo-Json -Compress

