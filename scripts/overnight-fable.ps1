<#
  Overnight autonomous redesign runner for Claude Code + Fable (Windows / PowerShell).

  Loops the backlog in DESIGN_UPGRADE.md one task per invocation, build-gates and
  commits after each, and on a usage limit sleeps until the daily reset hour
  (default 04:00 local) before resuming.

  Requirements: claude (logged in on a plan with Fable), node/npm, git.
  Launch (leave the window open, or use Task Scheduler):
      powershell -ExecutionPolicy Bypass -File scripts\overnight-fable.ps1

  SAFETY: uses --dangerously-skip-permissions so the agent runs unattended on a
  dedicated branch. It never pushes. Review the diff in the morning.
#>

param(
  [string]$Model     = "claude-fable-5",
  [int]$ResetHour    = 4,
  [int]$MaxIters     = 200,
  [string]$Branch    = "redesign/overnight"
)

$ErrorActionPreference = "Continue"
Set-Location (Join-Path $PSScriptRoot "..")

$PromptFile = "scripts\overnight-prompt.txt"
$Log        = "scripts\overnight.log"
$PostResetBufferSec = 180

function Log($msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  $line | Tee-Object -FilePath $Log -Append
}

# preflight
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) { Log "ERROR: 'claude' CLI not found."; exit 1 }
if (-not (Get-Command git -ErrorAction SilentlyContinue))    { Log "ERROR: git not found."; exit 1 }
if (-not (Test-Path $PromptFile))       { Log "ERROR: $PromptFile missing."; exit 1 }
if (-not (Test-Path "DESIGN_UPGRADE.md")) { Log "ERROR: DESIGN_UPGRADE.md missing."; exit 1 }

git rev-parse --verify $Branch *> $null
if ($LASTEXITCODE -ne 0) { git branch $Branch *> $null }
git checkout $Branch *>> $Log
Log "On branch $Branch. Model=$Model. Reset hour=${ResetHour}:00."

function Seconds-Until-Reset {
  $now = Get-Date
  $target = Get-Date -Hour $ResetHour -Minute 0 -Second 0
  if ($target -le $now) { $target = $target.AddDays(1) }
  return [int]($target - $now).TotalSeconds
}

function Remaining-Tasks {
  if (-not (Test-Path "DESIGN_UPGRADE.md")) { return 0 }
  return (Select-String -Path "DESIGN_UPGRADE.md" -Pattern '^- \[ \]' -AllMatches).Count
}

$prompt = Get-Content $PromptFile -Raw
$fails = 0

for ($i = 1; $i -le $MaxIters; $i++) {
  $left = Remaining-Tasks
  Log "Iteration $i - $left task(s) remaining."
  if ($left -eq 0) { Log "Backlog complete. Finishing."; break }

  $out = & claude -p $prompt --model $Model --dangerously-skip-permissions --output-format json 2>&1 | Out-String
  Add-Content -Path $Log -Value $out

  if ($out -match "(?i)usage limit|rate limit|limit reached|reset(s)? at|reached your .* limit") {
    $secs = Seconds-Until-Reset
    Log "Usage limit detected. Sleeping $secs s until ~${ResetHour}:00, then resuming."
    Start-Sleep -Seconds $secs
    Start-Sleep -Seconds $PostResetBufferSec
    continue   # retry the SAME task; nothing was ticked
  }

  npm run build *>> $Log
  if ($LASTEXITCODE -eq 0) {
    $fails = 0
    if (git status --porcelain) {
      git add -A
      git commit -m "overnight redesign: iteration $i" *>> $Log
      Log "Committed iteration $i (build green)."
    } else {
      Log "No file changes this iteration."
    }
  } else {
    $fails++
    Log "Build FAILED on iteration $i (consecutive fails: $fails). Committing WIP for review."
    git add -A
    git commit -m "overnight redesign: WIP build-failing iteration $i" *>> $Log
    if ($fails -ge 3) { Log "Three consecutive build failures. Stopping for human review."; break }
  }
}

Log "Runner finished. Review with: git log --oneline $Branch ; git diff main..$Branch"
