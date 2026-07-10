#!/usr/bin/env bash
#
# Overnight autonomous redesign runner for Claude Code + Fable.
#
# Loops over the backlog in DESIGN_UPGRADE.md, one task per invocation. After
# each task it build-gates and commits. When Claude Code reports a usage limit,
# it sleeps until the daily reset hour (default 04:00 local) and resumes.
#
# Requirements: claude (logged in on a plan that includes Fable), node/npm, git.
# Run from anywhere:   nohup bash scripts/overnight-fable.sh >/dev/null 2>&1 &
#
# SAFETY: this uses --dangerously-skip-permissions so the agent runs unattended.
# It works on a dedicated branch and never pushes. Review the diff in the morning.

set -uo pipefail
cd "$(dirname "$0")/.."

MODEL="${MODEL:-claude-fable-5}"
RESET_HOUR="${RESET_HOUR:-4}"          # local hour the plan's limit resets
MAX_ITERS="${MAX_ITERS:-200}"
BRANCH="${BRANCH:-redesign/overnight}"
PROMPT_FILE="scripts/overnight-prompt.txt"
LOG="scripts/overnight.log"
POST_RESET_BUFFER=180                    # seconds to wait after reset, to be safe

mkdir -p scripts
log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

# --- preflight -------------------------------------------------------------
command -v claude >/dev/null 2>&1 || { log "ERROR: 'claude' CLI not found."; exit 1; }
command -v git   >/dev/null 2>&1 || { log "ERROR: git not found."; exit 1; }
[ -f "$PROMPT_FILE" ] || { log "ERROR: $PROMPT_FILE missing."; exit 1; }
[ -f DESIGN_UPGRADE.md ] || { log "ERROR: DESIGN_UPGRADE.md missing."; exit 1; }

git rev-parse --verify "$BRANCH" >/dev/null 2>&1 || git branch "$BRANCH"
git checkout "$BRANCH" >>"$LOG" 2>&1 || { log "ERROR: cannot checkout $BRANCH"; exit 1; }
log "On branch $BRANCH. Model=$MODEL. Reset hour=$RESET_HOUR:00."

# seconds until the next RESET_HOUR:00 local (works on GNU and BSD date)
seconds_until_reset() {
  local now target
  now=$(date +%s)
  target=$(date -d "today ${RESET_HOUR}:00" +%s 2>/dev/null) \
    || target=$(date -v"${RESET_HOUR}"H -v0M -v0S +%s)
  if [ "$target" -le "$now" ]; then
    target=$(date -d "tomorrow ${RESET_HOUR}:00" +%s 2>/dev/null) \
      || target=$(date -v+1d -v"${RESET_HOUR}"H -v0M -v0S +%s)
  fi
  echo $(( target - now ))
}

remaining() { grep -c '^- \[ \]' DESIGN_UPGRADE.md 2>/dev/null || echo 0; }

fails=0
stall=0
for (( i=1; i<=MAX_ITERS; i++ )); do
  left=$(remaining)
  log "Iteration $i — $left task(s) remaining."
  if [ "${left:-0}" -eq 0 ]; then log "Backlog complete. Finishing."; break; fi

  out=$(claude -p "$(cat "$PROMPT_FILE")" \
          --model "$MODEL" \
          --dangerously-skip-permissions \
          --output-format json 2>&1) || true
  printf '%s\n' "$out" >> "$LOG"

  # --- not-authenticated: stop, this needs a human to run /login -----------
  if printf '%s' "$out" | grep -qiE "not logged in|please run /login|invalid.*api key|authentication_error|oauth"; then
    log "ERROR: Claude Code is not logged in. Run 'claude', then '/login', verify it replies, and restart this script."
    break
  fi

  # --- usage-limit handling ------------------------------------------------
  if printf '%s' "$out" | grep -qiE "usage limit|rate limit|limit reached|reset(s)? at|reached your .* limit"; then
    secs=$(seconds_until_reset)
    log "Usage limit detected. Sleeping ${secs}s until ~${RESET_HOUR}:00, then resuming."
    sleep "$secs"
    sleep "$POST_RESET_BUFFER"
    continue    # retry the SAME task; nothing was ticked
  fi

  # --- stall guard: task count must go down, else stop after 3 -------------
  if [ "$(remaining)" -ge "$left" ]; then
    stall=$(( stall + 1 ))
    log "No task completed this iteration (stall $stall/3)."
    if [ "$stall" -ge 3 ]; then
      log "ERROR: 3 iterations with no progress. Stopping for human review. Check $LOG."
      break
    fi
  else
    stall=0
  fi

  # --- build gate + commit -------------------------------------------------
  if npm run build >>"$LOG" 2>&1; then
    fails=0
    if [ -n "$(git status --porcelain)" ]; then
      git add -A
      git commit -m "overnight redesign: iteration $i" >>"$LOG" 2>&1 || true
      log "Committed iteration $i (build green)."
    else
      log "No file changes this iteration."
    fi
  else
    fails=$(( fails + 1 ))
    log "Build FAILED on iteration $i (consecutive fails: $fails). Committing WIP for review."
    git add -A
    git commit -m "overnight redesign: WIP build-failing iteration $i" >>"$LOG" 2>&1 || true
    if [ "$fails" -ge 3 ]; then
      log "Three consecutive build failures. Stopping for human review."
      break
    fi
  fi
done

log "Runner finished. Review with: git log --oneline $BRANCH ; git diff main..$BRANCH"
