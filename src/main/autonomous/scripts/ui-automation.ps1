param(
    [Parameter(Mandatory=$true)]
    [string]$Action,
    [string]$WindowTitle = "",
    [string]$ElementName = "",
    [string]$Text = "",
    [int]$Limit = 20
)

# Load UI Automation Assemblies
Add-Type -AssemblyName UIAutomationClient -ErrorAction SilentlyContinue
Add-Type -AssemblyName UIAutomationTypes -ErrorAction SilentlyContinue

$root = [System.Windows.Automation.AutomationElement]::RootElement

switch ($Action.ToLower()) {
    "list-windows" {
        $cond = [System.Windows.Automation.Condition]::TrueCondition
        $windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $cond)
        $list = @()
        foreach ($w in $windows) {
            $name = $w.Current.Name
            $procId = $w.Current.ProcessId
            if (-not [string]::IsNullOrWhiteSpace($name)) {
                $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
                $list += [PSCustomObject]@{
                    title = $name
                    processName = if ($proc) { $proc.ProcessName } else { "Unknown" }
                    processId = $procId
                    className = $w.Current.ClassName
                    isOffscreen = $w.Current.IsOffscreen
                }
                if ($list.Count -ge $Limit) { break }
            }
        }
        $list | ConvertTo-Json -Compress
    }

    "inspect-window" {
        if ([string]::IsNullOrWhiteSpace($WindowTitle)) {
            Write-Output '{"error":"WindowTitle obrigatorio"}'
            exit
        }

        $cond = [System.Windows.Automation.Condition]::TrueCondition
        $windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $cond)
        $targetWin = $null
        foreach ($w in $windows) {
            if ($w.Current.Name.ToLower().Contains($WindowTitle.ToLower())) {
                $targetWin = $w
                break
            }
        }

        if (-not $targetWin) {
            $err = "Janela contendo '$WindowTitle' nao encontrada."
            [PSCustomObject]@{ error = $err } | ConvertTo-Json -Compress
            exit
        }

        $elements = $targetWin.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
        $elementList = @()
        foreach ($el in $elements) {
            $name = $el.Current.Name
            $autoId = $el.Current.AutomationId
            $ctrlType = $el.Current.ControlType.ProgrammaticName
            if (-not [string]::IsNullOrWhiteSpace($name) -or -not [string]::IsNullOrWhiteSpace($autoId)) {
                $elementList += [PSCustomObject]@{
                    name = $name
                    automationId = $autoId
                    controlType = $ctrlType
                    isEnabled = $el.Current.IsEnabled
                }
                if ($elementList.Count -ge $Limit) { break }
            }
        }

        [PSCustomObject]@{
            windowTitle = $targetWin.Current.Name
            processId = $targetWin.Current.ProcessId
            elements = $elementList
        } | ConvertTo-Json -Compress
    }

    "click-element" {
        if ([string]::IsNullOrWhiteSpace($WindowTitle) -or [string]::IsNullOrWhiteSpace($ElementName)) {
            Write-Output '{"error":"WindowTitle e ElementName obrigatorios"}'
            exit
        }

        $cond = [System.Windows.Automation.Condition]::TrueCondition
        $windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $cond)
        $targetWin = $null
        foreach ($w in $windows) {
            if ($w.Current.Name.ToLower().Contains($WindowTitle.ToLower())) {
                $targetWin = $w
                break
            }
        }

        if (-not $targetWin) {
            $err = "Janela contendo '$WindowTitle' nao encontrada."
            [PSCustomObject]@{ error = $err } | ConvertTo-Json -Compress
            exit
        }

        $elements = $targetWin.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
        $found = $null
        foreach ($el in $elements) {
            if ($el.Current.Name.ToLower().Contains($ElementName.ToLower()) -or $el.Current.AutomationId.ToLower().Contains($ElementName.ToLower())) {
                $found = $el
                break
            }
        }

        if (-not $found) {
            $err = "Elemento '$ElementName' nao encontrado na janela."
            [PSCustomObject]@{ error = $err } | ConvertTo-Json -Compress
            exit
        }

        try {
            $invokePattern = $found.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
            if ($invokePattern) {
                $invokePattern.Invoke()
                [PSCustomObject]@{ success = $true; action = "invoked"; element = $found.Current.Name } | ConvertTo-Json -Compress
                exit
            }
        } catch {}

        try {
            $selPattern = $found.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
            if ($selPattern) {
                $selPattern.Select()
                [PSCustomObject]@{ success = $true; action = "selected"; element = $found.Current.Name } | ConvertTo-Json -Compress
                exit
            }
        } catch {}

        [PSCustomObject]@{ success = $false; error = "Elemento encontrado mas nao suporta clique/invocacao direta." } | ConvertTo-Json -Compress
    }

    "set-text" {
        if ([string]::IsNullOrWhiteSpace($WindowTitle) -or [string]::IsNullOrWhiteSpace($ElementName) -or [string]::IsNullOrWhiteSpace($Text)) {
            Write-Output '{"error":"WindowTitle, ElementName e Text obrigatorios"}'
            exit
        }

        $cond = [System.Windows.Automation.Condition]::TrueCondition
        $windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $cond)
        $targetWin = $null
        foreach ($w in $windows) {
            if ($w.Current.Name.ToLower().Contains($WindowTitle.ToLower())) {
                $targetWin = $w
                break
            }
        }

        if (-not $targetWin) {
            $err = "Janela contendo '$WindowTitle' nao encontrada."
            [PSCustomObject]@{ error = $err } | ConvertTo-Json -Compress
            exit
        }

        $elements = $targetWin.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
        $found = $null
        foreach ($el in $elements) {
            if ($el.Current.Name.ToLower().Contains($ElementName.ToLower()) -or $el.Current.AutomationId.ToLower().Contains($ElementName.ToLower())) {
                $found = $el
                break
            }
        }

        if (-not $found) {
            $err = "Elemento '$ElementName' nao encontrado."
            [PSCustomObject]@{ error = $err } | ConvertTo-Json -Compress
            exit
        }

        try {
            $valPattern = $found.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
            if ($valPattern) {
                $valPattern.SetValue($Text)
                [PSCustomObject]@{ success = $true; action = "setValue"; element = $found.Current.Name } | ConvertTo-Json -Compress
                exit
            }
        } catch {
            [PSCustomObject]@{ success = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
            exit
        }

        [PSCustomObject]@{ success = $false; error = "Elemento nao suporta ValuePattern para escrita de texto." } | ConvertTo-Json -Compress
    }

    default {
        [PSCustomObject]@{ error = "Acao desconhecida: $Action" } | ConvertTo-Json -Compress
    }
}

