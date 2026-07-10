<#
  Overnight autonomous redesign runner for Claude Code + Fable (Windows / PowerShell).

  Loops the backlog in DESIGN_UPGRADE.md one task per invocation, build-gates and
  commits after each, and on a usage/session limit sleeps until the reset time
  stated in the limit message (fallback: 1 hour) before resuming the SAME Claude
  session via --resume, so mid-task work is not lost.

  Requirements: claude (logged in on a plan with Fable), node/npm, git.
  Launch (leave the window open, or use Task Scheduler):
      powershell -ExecutionPolicy Bypass -File scripts\overnight-fable.ps1

  SAFETY: uses --dangerously-skip-permissions so the agent runs unattended on a
  dedicated branch. It never pushes. Review the diff in the morning.
#>

param(
  [string]$Model = "claude-fable-5",
  [int]$MaxIters = 200,
  [string]$Branch = "redesign/overnight",
  [decimal]$MaxUsdPerRun = 4.00,
  [int]$MaxTurns = 30
)

$ErrorActionPreference = "Continue"
Set-Location (Join-Path $PSScriptRoot "..")

$PromptFile = "scripts\overnight-prompt.txt"
$Log = "scripts\overnight.log"
$SessionFile = ".claude\overnight-session-id"
$PostResetBufferSec = 180
$FallbackSleepSec = 3600

New-Item -ItemType Directory -Force -Path ".claude" | Out-Null

function Log($msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  $line | Tee-Object -FilePath $Log -Append
}

# Runs one headless Claude task. Resumes the saved session if one is pending
# (i.e. a previous run was cut off mid-task by a usage limit).
function Invoke-ClaudeTask {
  param([string]$Prompt, [string]$Model, [int]$MaxTurns)
  $claudeArgs = @(
    "-p", $Prompt,
    "--model", $Model,
    "--dangerously-skip-permissions",
    "--output-format", "json",
    "--max-turns", $MaxTurns
  )
  if (Test-Path $SessionFile) {
    $sid = (Get-Content $SessionFile -Raw).Trim()
    if ($sid) {
      $claudeArgs += @("--resume", $sid)
      Log "Resuming interrupted Claude session $sid"
    }
  }
  return (& claude @claudeArgs 2>&1 | Out-String)
}

# Extracts the JSON result object from the raw CLI output (which may be
# polluted with stdin warnings / NativeCommandError noise).
function Get-ClaudeResult {
  param([string]$RawOutput)
  $jsonLine = ($RawOutput -split "`r?`n") |
    Where-Object { $_.Trim().StartsWith('{') -and $_.Trim().EndsWith('}') } |
    Select-Object -Last 1
  if (-not $jsonLine) { return $null }
  try { return $jsonLine | ConvertFrom-Json } catch { return $null }
}

# Seconds until a clock time like "12:30pm", "4am", or "16:00" next occurs.
function Seconds-Until-Time([string]$timeText) {
  $t = ($timeText -replace '\s', '').ToUpper()
  foreach ($f in @('h:mmtt', 'htt', 'H:mm')) {
    try {
      $parsed = [datetime]::ParseExact($t, $f, [Globalization.CultureInfo]::InvariantCulture)
      $now = Get-Date
      $target = Get-Date -Hour $parsed.Hour -Minute $parsed.Minute -Second 0
      if ($target -le $now) { $target = $target.AddDays(1) }
      return [int]($target - $now).TotalSeconds
    } catch {}
  }
  return $null
}

function Remaining-Tasks {
  if (-not (Test-Path "DESIGN_UPGRADE.md")) { return 0 }
  return (Select-String -Path "DESIGN_UPGRADE.md" -Pattern '^- \[ \]' -AllMatches).Count
}

# preflight
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) { Log "ERROR: 'claude' CLI not found."; exit 1 }
if (-not (Get-Command git -ErrorAction SilentlyContinue))    { Log "ERROR: git not found."; exit 1 }
if (-not (Test-Path $PromptFile))       { Log "ERROR: $PromptFile missing."; exit 1 }
if (-not (Test-Path "DESIGN_UPGRADE.md")) { Log "ERROR: DESIGN_UPGRADE.md missing."; exit 1 }

git rev-parse --verify $Branch *> $null
if ($LASTEXITCODE -ne 0) { git branch $Branch *> $null }
git checkout $Branch *>> $Log
Log "On branch $Branch. Model=$Model. MaxUsdPerRun=$MaxUsdPerRun. MaxTurns=$MaxTurns."

$prompt = Get-Content $PromptFile -Raw
$stall = 0

for ($i = 1; $i -le $MaxIters; $i++) {
  $left = Remaining-Tasks
  Log "Iteration $i - $left task(s) remaining."
  if ($left -eq 0) { Log "Backlog complete. Finishing."; break }

  $out = Invoke-ClaudeTask -Prompt $prompt -Model $Model -MaxTurns $MaxTurns
  Add-Content -Path $Log -Value $out

  $result = Get-ClaudeResult -RawOutput $out
  if ($null -eq $result) {
    Log "ERROR: Claude returned no parseable JSON. Stopping before build or commit."
    exit 1
  }

  $resultText = [string]$result.result

  if ($resultText -match "(?i)not logged in|please run /login|invalid.*api key|authentication_error|oauth") {
    Log "ERROR: Claude Code is not logged in. Run 'claude', then '/login', and restart this script."
    exit 1
  }

  # Remember sessions that did real work so a limit-interrupted task can be
  # resumed. Instant failures (num_turns <= 1) must not clobber the saved id.
  if ($result.session_id -and $result.num_turns -gt 1) {
    $result.session_id | Set-Content $SessionFile
  }

  if ($result.api_error_status -eq 429 -or $resultText -match "(?i)usage limit|session limit|rate limit|limit reached|reached your .* limit|resets") {
    $secs = $null
    if ($resultText -match "(?i)resets?\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)") {
      $secs = Seconds-Until-Time $Matches[1]
    }
    if (-not $secs) { $secs = $FallbackSleepSec }
    $secs += $PostResetBufferSec
    Log "Usage/session limit detected: $resultText"
    Log "Sleeping $secs s, then resuming the same task."
    Start-Sleep -Seconds $secs
    continue
  }

  if ($result.is_error -eq $true) {
    Log "ERROR: Claude returned is_error=true. Stopping before build or commit."
    Log "Claude result: $resultText"
    exit 1
  }

  if ($result.total_cost_usd -gt $MaxUsdPerRun) {
    Log "WARNING: iteration cost `$$($result.total_cost_usd) exceeded MaxUsdPerRun `$$MaxUsdPerRun."
  }

  # Stall guard: if the unchecked-task count is not going down, Fable is not
  # registering progress. Stop after 3 such iterations rather than spin.
  if ((Remaining-Tasks) -ge $left) {
    $stall++
    Log "No task completed this iteration (stall $stall/3)."
    if ($stall -ge 3) {
      Log "ERROR: 3 iterations with no progress. Stopping for human review. Check $Log."
      break
    }
  } else {
    $stall = 0
  }

  npm run build *>> $Log
  $buildExit = $LASTEXITCODE

  npm run lint *>> $Log
  $lintExit = $LASTEXITCODE

  if ($buildExit -ne 0 -or $lintExit -ne 0) {
    Log "Build or lint FAILED on iteration $i. Build exit=$buildExit, lint exit=$lintExit."
    Log "Not committing WIP. Stopping for human review."
    exit 1
  }

  if (git status --porcelain) {
    git add -A
    git commit -m "overnight redesign: iteration $i" *>> $Log
    if ($LASTEXITCODE -eq 0) {
      Log "Committed iteration $i (build and lint green)."
    } else {
      Log "ERROR: git commit failed. Stopping."
      exit 1
    }
  } else {
    Log "No file changes this iteration."
  }

  # Iteration concluded cleanly; the next task starts a fresh session.
  if (Test-Path $SessionFile) {
    Remove-Item $SessionFile -Force
  }
}

Log "Runner finished. Review with: git log --oneline $Branch ; git diff main..$Branch"
