$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$executable = Join-Path $projectRoot 'release\win-unpacked\Jasper AI.exe'
if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
    throw 'Executavel empacotado nao encontrado. Execute npm run package:dir primeiro.'
}

$smokeRoot = Join-Path $env:TEMP 'jasper-packaged-smoke-ci'
$appDataRoot = Join-Path $smokeRoot 'appdata'
$screenshotRoot = Join-Path $smokeRoot 'screenshots'
New-Item -ItemType Directory -Path $appDataRoot, $screenshotRoot -Force | Out-Null

$env:APPDATA = $appDataRoot
$env:SCREENSHOT_OUT_DIR = $screenshotRoot
$process = Start-Process -FilePath $executable -ArgumentList @('--capture-screenshot', "--user-data-dir=$appDataRoot") -WindowStyle Hidden -PassThru
if (-not $process.WaitForExit(30000)) {
    $process.Kill()
    throw 'Smoke test excedeu 30 segundos.'
}
if ($process.ExitCode -ne 0) {
    throw "Aplicacao empacotada encerrou com codigo $($process.ExitCode)."
}

$screenshot = Join-Path $screenshotRoot 'app_screenshot.png'
if (-not (Test-Path -LiteralPath $screenshot -PathType Leaf) -or (Get-Item -LiteralPath $screenshot).Length -lt 10000) {
    throw 'Smoke test nao gerou uma captura valida.'
}

$runtimeLog = Get-ChildItem -LiteralPath $appDataRoot -Filter 'jasper-runtime-*.log' -Recurse -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if (-not $runtimeLog) {
    throw 'Smoke test nao gerou log de runtime.'
}

$logText = Get-Content -LiteralPath $runtimeLog.FullName -Raw
if ($logText -match 'EvalError|IPC rejeitado|Uncaught') {
    throw 'Smoke test encontrou erro de CSP, IPC ou excecao nao tratada.'
}
if ($logText -notmatch 'Avatar model loaded successfully') {
    throw 'Avatar nao concluiu o carregamento no smoke test.'
}

Write-Output "Smoke test aprovado: $screenshot"
