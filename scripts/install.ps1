<#
.SYNOPSIS
    Installs (or updates) the Claude Status Bar mod for Claude Code.

.PARAMETER CacheTtl
    Prompt cache TTL used for the countdown: 5m (default) or 1h.
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
    [ValidateSet('5m', '1h')]
    [string]$CacheTtl = $(if ($env:CSB_CACHE_TTL) { $env:CSB_CACHE_TTL } else { '5m' }),
    [switch]$KeepStatusLine = ($env:CSB_KEEP_STATUSLINE -eq '1')
)

$ErrorActionPreference = 'Stop'

$Repo        = $(if ($env:CSB_SOURCE) { $env:CSB_SOURCE } else { 'AleVin76/claude-status-bar' })
$Marketplace = 'claude-status-bar'
$PluginId    = "statusbar@$Marketplace"
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
    Write-Step "Installing $PluginId (cacheTtl=$CacheTtl)"
    $r = Invoke-Claude plugin install $PluginId --config "cacheTtl=$CacheTtl"
}
if ($r.ExitCode -ne 0) { throw "Plugin step failed:`n$($r.Output)" }

# 4. settings.json: drop the old command-based status line so only one bar is shown
$settingsPath = Join-Path $env:USERPROFILE '.claude\settings.json'
if (-not $KeepStatusLine -and (Test-Path $settingsPath)) {
    $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json
    if ($settings.PSObject.Properties.Name -contains 'statusLine') {
        $backup = "$settingsPath.$(Get-Date -Format 'yyyyMMdd-HHmmss').bak"
        Copy-Item $settingsPath $backup
        $settings.PSObject.Properties.Remove('statusLine')
        $json = $settings | ConvertTo-Json -Depth 64
        [IO.File]::WriteAllText($settingsPath, $json, (New-Object Text.UTF8Encoding $false))
        Write-Step "Removed 'statusLine' from settings.json (backup: $backup)"
    }
}

Write-Host ''
Write-Host 'Claude Status Bar installed. Restart Claude Code (or run /reload-plugins in an open session).' -ForegroundColor Green
