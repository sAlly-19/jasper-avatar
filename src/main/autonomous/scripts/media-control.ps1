param(
    [Parameter(Mandatory=$true)]
    [string]$Action,
    [int]$Value = 0
)

$wscript = New-Object -ComObject WScript.Shell

switch ($Action.ToLower()) {
    "volume-up" {
        $steps = if ($Value -gt 0) { [Math]::Min(50, [Math]::Max(1, [Math]::Round($Value / 2))) } else { 2 }
        for ($i = 0; $i -lt $steps; $i++) {
            $wscript.SendKeys([char]175)
            Start-Sleep -Milliseconds 20
        }
        Write-Output "VOLUME_UP_OK"
    }
    "volume-down" {
        $steps = if ($Value -gt 0) { [Math]::Min(50, [Math]::Max(1, [Math]::Round($Value / 2))) } else { 2 }
        for ($i = 0; $i -lt $steps; $i++) {
            $wscript.SendKeys([char]174)
            Start-Sleep -Milliseconds 20
        }
        Write-Output "VOLUME_DOWN_OK"
    }
    "mute" {
        $wscript.SendKeys([char]173)
        Write-Output "VOLUME_MUTE_OK"
    }
    "play-pause" {
        $wscript.SendKeys([char]179)
        Write-Output "MEDIA_PLAY_PAUSE_OK"
    }
    "next" {
        $wscript.SendKeys([char]176)
        Write-Output "MEDIA_NEXT_OK"
    }
    "prev" {
        $wscript.SendKeys([char]177)
        Write-Output "MEDIA_PREV_OK"
    }
    "stop" {
        $wscript.SendKeys([char]178)
        Write-Output "MEDIA_STOP_OK"
    }
    default {
        Write-Output "UNKNOWN_ACTION: $Action"
    }
}

