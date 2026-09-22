param(
    [Parameter(Mandatory=$true)]
    [string]$Query,
    [int]$Limit = 15
)

$results = @()
$q = $Query.Trim().ToLower()

# 0. Fast-path: Common built-in Windows applications
$commonApps = @{
    "calc" = "Calculadora"; "calculadora" = "Calculadora";
    "notepad" = "Bloco de Notas"; "bloco de notas" = "Bloco de Notas";
    "cmd" = "Prompt de Comando"; "terminal" = "Terminal do Windows";
    "explorer" = "Explorador de Arquivos"; "paint" = "Paint";
    "control" = "Painel de Controle"; "taskmgr" = "Gerenciador de Tarefas";
    "regedit" = "Editor do Registro"; "snippingtool" = "Ferramenta de Captura"
}

foreach ($key in $commonApps.Keys) {
    if ($key.Contains($q) -or $commonApps[$key].ToLower().Contains($q)) {
        if (-not ($results | Where-Object { $_.name -eq $commonApps[$key] })) {
            $results += [PSCustomObject]@{
                name = $commonApps[$key]
                appId = "$key.exe"
                source = "BuiltIn"
                path = "$key.exe"
            }
        }
    }
}

if ($results.Count -gt 0) {
    $results | ConvertTo-Json -Compress
    exit
}

# 1. Fast-path: Registered applications in Registry App Paths (HKLM & HKCU)
try {
    $regPaths = @(
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths\*",
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\*"
    )
    foreach ($rp in $regPaths) {
        $found = Get-ItemProperty $rp -ErrorAction SilentlyContinue | Where-Object {
            $_.PSChildName.ToLower().Contains($q)
        }
        foreach ($item in $found) {
            $appName = [System.IO.Path]::GetFileNameWithoutExtension($item.PSChildName)
            $exePath = if ($item.'(default)') { $item.'(default)' } else { $item.PSChildName }
            if (-not ($results | Where-Object { $_.name -eq $appName })) {
                $results += [PSCustomObject]@{
                    name = $appName
                    appId = $item.PSChildName
                    source = "AppPaths"
                    path = $exePath
                }
            }
            if ($results.Count -ge $Limit) { break }
        }
        if ($results.Count -ge $Limit) { break }
    }
} catch {}

if ($results.Count -gt 0) {
    $results | ConvertTo-Json -Compress
    exit
}

# 2. Fast-path: Start Menu Shortcuts (.lnk) - shallow depth
$shortcutDirs = @(
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
    "$env:ProgramData\Microsoft\Windows\Start Menu\Programs"
)
foreach ($dir in $shortcutDirs) {
    if (Test-Path $dir) {
        $links = Get-ChildItem -Path $dir -Filter "*$q*.lnk" -Recurse -Depth 2 -File -ErrorAction SilentlyContinue | Select-Object -First ($Limit - $results.Count)
        foreach ($link in $links) {
            $name = $link.BaseName
            if (-not ($results | Where-Object { $_.name -eq $name })) {
                $results += [PSCustomObject]@{
                    name = $name
                    appId = $link.FullName
                    source = "StartMenuLink"
                    path = $link.FullName
                }
            }
        }
    }
    if ($results.Count -ge $Limit) { break }
}

if ($results.Count -gt 0) {
    $results | ConvertTo-Json -Compress
    exit
}

# 3. Check if Voidtools Everything CLI (es.exe) is available
$esPath = $null
if (Get-Command "es.exe" -ErrorAction SilentlyContinue) {
    $esPath = "es.exe"
} elseif (Test-Path "C:\Program Files\Everything\es.exe") {
    $esPath = "C:\Program Files\Everything\es.exe"
} elseif (Test-Path "C:\Program Files (x86)\Everything\es.exe") {
    $esPath = "C:\Program Files (x86)\Everything\es.exe"
}

if ($esPath) {
    try {
        $esOutput = & $esPath -n $Limit -s "$q.exe" 2>$null
        if ($esOutput) {
            foreach ($line in $esOutput) {
                $base = [System.IO.Path]::GetFileNameWithoutExtension($line)
                if (-not ($results | Where-Object { $_.name -eq $base })) {
                    $results += [PSCustomObject]@{
                        name = $base
                        appId = $line
                        source = "EverythingCLI"
                        path = $line
                    }
                }
            }
        }
    } catch {}
}

$results | ConvertTo-Json -Compress
