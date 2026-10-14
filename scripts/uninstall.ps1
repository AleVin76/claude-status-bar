<#
.SYNOPSIS
    Removes the Claude Status Bar mod and, optionally, restores the previous status line.

.PARAMETER RestoreStatusLine
    Restores "statusLine" from the most recent settings.json backup made by install.ps1.

.PARAMETER KeepMarketplace
    Leaves the claude-status-bar marketplace registered.
#>
[CmdletBinding()]
param(
    [switch]$RestoreStatusLine,
    [switch]$KeepMarketplace
)

$ErrorActionPreference = 'Stop'

$Marketplace = 'claude-status-bar'
$PluginId    = "statusbar@$Marketplace"

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    throw "Claude Code ('claude') not found in PATH."
}

& claude plugin uninstall $PluginId
if (-not $KeepMarketplace) { & claude plugin marketplace remove $Marketplace }

if ($RestoreStatusLine) {
    $settingsPath = Join-Path $env:USERPROFILE '.claude\settings.json'
    $backup = Get-ChildItem "$settingsPath.*.bak" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $backup) {
        Write-Warning 'No settings.json backup found: statusLine not restored.'
    } else {
        $old = Get-Content $backup.FullName -Raw | ConvertFrom-Json
        $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json
        if ($old.PSObject.Properties.Name -contains 'statusLine') {
            $settings | Add-Member -NotePropertyName statusLine -NotePropertyValue $old.statusLine -Force
            $json = $settings | ConvertTo-Json -Depth 64
            [IO.File]::WriteAllText($settingsPath, $json, (New-Object Text.UTF8Encoding $false))
            Write-Host "statusLine restored from $($backup.Name)"
        }
    }
}

Write-Host 'Claude Status Bar removed. Restart Claude Code.' -ForegroundColor Green
