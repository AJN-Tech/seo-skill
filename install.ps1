# seo-skill installer for Windows PowerShell
#
# Installs the `seo` Agent Skill for Codex, OpenCode, DeepSeek Harness, Cursor,
# Gemini CLI (~/.agents/skills) and Claude Code (~/.claude/skills).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File install.ps1
#   powershell -ExecutionPolicy Bypass -File install.ps1 -All
#   powershell -ExecutionPolicy Bypass -File install.ps1 -Harness claude
#   powershell -ExecutionPolicy Bypass -File install.ps1 -Project C:\src\mysite
#   powershell -ExecutionPolicy Bypass -File install.ps1 -Check
#   powershell -ExecutionPolicy Bypass -File install.ps1 -Uninstall

[CmdletBinding()]
param(
  [switch]$All,
  [string[]]$Harness = @(),
  [string]$Project = "",
  [switch]$Force,
  [switch]$DryRun,
  [switch]$Check,
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$SkillName = "seo"
$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$HomeDir = [Environment]::GetFolderPath("UserProfile")

function Get-Targets {
  $targets = New-Object System.Collections.Generic.List[string]
  function Add([string]$path) {
    if (-not $targets.Contains($path)) { [void]$targets.Add($path) }
  }

  if ($Project -ne "") {
    $resolved = (Resolve-Path $Project).Path
    Add (Join-Path $resolved ".agents\skills\$SkillName")
    Add (Join-Path $resolved ".claude\skills\$SkillName")
    return $targets
  }

  $names = @($Harness)
  if ($names.Count -eq 0) { $names = @("agents") }

  foreach ($name in $names) {
    switch ($name.ToLowerInvariant()) {
      "agents"   { Add (Join-Path $HomeDir ".agents\skills\$SkillName") }
      "codex"    { Add (Join-Path $HomeDir ".agents\skills\$SkillName") }
      "claude"   { Add (Join-Path $HomeDir ".claude\skills\$SkillName") }
      "opencode" { Add (Join-Path $HomeDir ".agents\skills\$SkillName") }
      "dsh"      { Add (Join-Path $HomeDir ".agents\skills\$SkillName") }
      "cursor"   { Add (Join-Path $HomeDir ".agents\skills\$SkillName") }
      "gemini"   { Add (Join-Path $HomeDir ".agents\skills\$SkillName") }
      "all"      {
        Add (Join-Path $HomeDir ".agents\skills\$SkillName")
        Add (Join-Path $HomeDir ".claude\skills\$SkillName")
      }
      default { Write-Error "unknown harness: $name" }
    }
  }
  if ($All) {
    Add (Join-Path $HomeDir ".agents\skills\$SkillName")
    Add (Join-Path $HomeDir ".claude\skills\$SkillName")
  }
  return $targets
}

function Assert-Target([string]$path) {
  if (-not ($path -match "skills[\\/]seo$")) {
    throw "refusing unsafe target path: $path"
  }
}

function Copy-Skill([string]$target) {
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  foreach ($file in @("SKILL.md", "README.md", "LICENSE")) {
    $src = Join-Path $SourceDir $file
    if (Test-Path $src) { Copy-Item $src (Join-Path $target $file) -Force }
  }
  foreach ($dir in @("references", "scripts", "docs")) {
    $src = Join-Path $SourceDir $dir
    if (Test-Path $src) { Copy-Item $src (Join-Path $target $dir) -Recurse -Force }
  }
}

$targets = Get-Targets
$status = 0
foreach ($target in $targets) {
  Assert-Target $target
  if ($Check) {
    if (Test-Path (Join-Path $target "SKILL.md")) { Write-Host "ok    -> $target" }
    else { Write-Host "MISSING -> $target"; $status = 1 }
    continue
  }
  if ($Uninstall) {
    if (Test-Path $target) {
      if ($DryRun) { Write-Host "would remove $target" }
      else { Remove-Item $target -Recurse -Force; Write-Host "removed -> $target" }
    } else { Write-Host "not installed -> $target" }
    continue
  }
  if (Test-Path $target) {
    if (-not $Force) { throw "already exists: $target (use -Force to replace)" }
    if ($DryRun) { Write-Host "would replace $target" } else { Remove-Item $target -Recurse -Force }
  }
  if ($DryRun) { Write-Host "would install -> $target"; continue }
  Copy-Skill $target
  Write-Host "installed -> $target"
}

if (-not $Check -and -not $Uninstall -and -not $DryRun) {
  Write-Host ""
  Write-Host "Verify in your harness (restart if it was open):"
  Write-Host "  Claude Code      /seo"
  Write-Host "  Codex            /skills or `$seo"
  Write-Host "  OpenCode         ask for an SEO audit"
  Write-Host "  DeepSeek Harness new session; skill list should include 'seo'"
  Write-Host "  Cursor           /seo or @seo"
  Write-Host "  Gemini CLI       /skills list"
}
exit $status
