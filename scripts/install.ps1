<#
.SYNOPSIS
    Installs (or updates) the Claude Status Bar mod for Claude Code.

.PARAMETER CacheTtl
    Sets Claude Code's prompt cache TTL ("promptCacheTtl" in settings.json): 5m or 1h.
    Left out, the current setting is kept (unset = automatic: 1h on a subscription, 5m on an API key).
    The TTL can also be switched later from the status bar.
    One-liner equivalent: $env:CSB_CACHE_TTL.

.PARAMETER KeepStatusLine
    Keeps the existing "statusLine" entry in settings.json.
    One-liner equivalent: $env:CSB_KEEP_STATUSLINE = '1'.

.EXAMPLE
    irm https://raw.githubusercontent.com/AleVin76/claude-status-bar/main/scripts/install.ps1 | iex

.EXAMPLE
    .\install.ps1 -CacheTtl 1h
#>
[CmdletBinding()]
param(
    [ValidateSet('', '5m', '1h')]
    [string]$CacheTtl = $(if ($env:CSB_CACHE_TTL) { $env:CSB_CACHE_TTL } else { '' }),
    [switch]$KeepStatusLine = ($env:CSB_KEEP_STATUSLINE -eq '1')
)

$ErrorActionPreference = 'Stop'

$Repo        = $(if ($env:CSB_SOURCE) { $env:CSB_SOURCE } else { 'AleVin76/claude-status-bar' })
$Marketplace = 'claude-status-bar'
$PluginId    = "statusbar@$Marketplace"

# Every plugin option gets a stored value: an unset one makes Claude Code ask to configure the plugin
$OptionDefaults = [ordered]@{
    locale             = 'system'
    soundOnComplete    = $true
    soundOnQuestion    = $true
    completeSound      = 'default'
    questionSound      = 'default'
    completeMinSeconds = 15
}

function Format-Option($value) {
    if ($value -is [bool]) { return $value.ToString().ToLower() }
    return "$value"
}
$MinVersion  = [version]'2.1.287'

function Write-Step([string]$Message) { Write-Host "==> $Message" -ForegroundColor Cyan }

function Invoke-Claude {
    param([Parameter(ValueFromRemainingArguments)][string[]]$Arguments)
    # Windows PowerShell 5.1 turns native stderr into terminating errors under 'Stop'
    $ErrorActionPreference = 'Continue'
    $output = & claude @Arguments 2>&1 | Out-String
    [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $output.Trim() }
}

# 1. Claude Code present and recent enough for mods
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    throw "Claude Code ('claude') not found in PATH. Install it first: https://code.claude.com"
}
$versionText = (& claude --version) -replace '^\s*([\d.]+).*$', '$1'
if ([version]$versionText -lt $MinVersion) {
    throw "Claude Code $versionText is too old: mods need $MinVersion or later. Run 'claude update'."
}
Write-Step "Claude Code $versionText"

# 2. Marketplace (add, or refresh when already present)
$known = (Invoke-Claude plugin marketplace list --json).Output | ConvertFrom-Json
if ($known | Where-Object { $_.name -eq $Marketplace }) {
    Write-Step "Updating marketplace $Marketplace"
    $r = Invoke-Claude plugin marketplace update $Marketplace
} else {
    Write-Step "Adding marketplace $Repo"
    $r = Invoke-Claude plugin marketplace add $Repo
}
if ($r.ExitCode -ne 0) { throw "Marketplace step failed:`n$($r.Output)" }

# 3. Plugin (install, or update when already installed)
$installed = (Invoke-Claude plugin list --json).Output | ConvertFrom-Json
if ($installed | Where-Object { $_.id -eq $PluginId }) {
    Write-Step "Updating $PluginId"
    $r = Invoke-Claude plugin update $PluginId
} else {
    Write-Step "Installing $PluginId"
    $configArgs = foreach ($name in $OptionDefaults.Keys) { '--config'; "$name=$(Format-Option $OptionDefaults[$name])" }
    $r = Invoke-Claude plugin install $PluginId --scope user @configArgs
}
if ($r.ExitCode -ne 0) { throw "Plugin step failed:`n$($r.Output)" }

# An update keeps a plugin that was disabled disabled: enable it explicitly
$r = Invoke-Claude plugin enable $PluginId --scope user --json
$enable = ($r.Output -split "`r?`n" | Where-Object { $_ -match '^\{' } | Select-Object -First 1) | ConvertFrom-Json
if ($r.ExitCode -ne 0 -and -not $enable.alreadyInGoalState) { throw "Enable step failed:`n$($r.Output)" }
if (-not $enable.alreadyInGoalState) { Write-Step "Enabled $PluginId" }

# 4. settings.json: old status line, prompt cache TTL, option dropped in 1.3.0
$settingsPath = Join-Path $env:USERPROFILE '.claude\settings.json'
if (Test-Path $settingsPath) {
    $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json
} else {
    $settings = [pscustomobject]@{}
}
$changes = @()

if (-not $KeepStatusLine -and $settings.PSObject.Properties.Name -contains 'statusLine') {
    $settings.PSObject.Properties.Remove('statusLine')
    $changes += "removed 'statusLine'"
}

if ($CacheTtl) {
    $settings | Add-Member -NotePropertyName promptCacheTtl -NotePropertyValue $CacheTtl -Force
    $changes += "promptCacheTtl = $CacheTtl"
}

$options = $settings.pluginConfigs.$PluginId.options
if ($options -and $options.PSObject.Properties.Name -contains 'cacheTtl') {
    $options.PSObject.Properties.Remove('cacheTtl')
    $changes += "removed obsolete statusbar option 'cacheTtl'"
}
# Options added by later versions, and an empty locale (before 1.3.2 it meant "system"), get their default
if ($options) {
    foreach ($name in $OptionDefaults.Keys) {
        $current = $options.PSObject.Properties[$name]
        if (-not $current -or ($current.Value -is [string] -and $current.Value.Trim() -eq '')) {
            $options | Add-Member -NotePropertyName $name -NotePropertyValue $OptionDefaults[$name] -Force
            $changes += "statusbar option '$name' = $(Format-Option $OptionDefaults[$name])"
        }
    }
}

if ($changes.Count -gt 0) {
    if (Test-Path $settingsPath) {
        $backup = "$settingsPath.$(Get-Date -Format 'yyyyMMdd-HHmmss').bak"
        Copy-Item $settingsPath $backup
        Write-Step "Backup of settings.json: $backup"
    } else {
        New-Item -ItemType Directory -Force -Path (Split-Path $settingsPath) | Out-Null
    }
    $json = $settings | ConvertTo-Json -Depth 64
    [IO.File]::WriteAllText($settingsPath, $json, (New-Object Text.UTF8Encoding $false))
    Write-Step "settings.json: $($changes -join ', ')"
}

# 5. Verify: installed, enabled, and not switched off by disableAllHooks
$entry = ((Invoke-Claude plugin list --json).Output | ConvertFrom-Json) | Where-Object { $_.id -eq $PluginId }
if (-not $entry) { throw "$PluginId is not listed by 'claude plugin list' after installation." }
if (-not $entry.enabled) { throw "$PluginId is installed but still disabled. Run: claude plugin enable $PluginId" }
Write-Step "$PluginId $($entry.version) installed and enabled"

$merged = if (Test-Path $settingsPath) { Get-Content $settingsPath -Raw | ConvertFrom-Json } else { $null }
if ($merged -and $merged.disableAllHooks -eq $true) {
    Write-Warning ("'disableAllHooks' is true in $settingsPath`: Claude Code loads no mod, so the status bar stays hidden. " +
        "Set it to false (it also re-enables your other hooks) to see the bar.")
}

Write-Host ''
Write-Host 'Claude Status Bar installed. Restart Claude Code (or run /reload-plugins in an open session).' -ForegroundColor Green
