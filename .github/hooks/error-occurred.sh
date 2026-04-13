#!/usr/bin/env bash
# EJS Hook: errorOccurred
# Logs Copilot runtime errors to JSONL audit trail for diagnostics.
# Input (stdin): JSON with timestamp, cwd, error{name,message,stack}
# Output: none (ignored by platform)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INPUT="$(cat || true)"

# Parse input defensively.
TIMESTAMP="$(echo "$INPUT" | jq -r '.timestamp // empty' 2>/dev/null || true)"
ERROR_NAME="$(echo "$INPUT" | jq -r '.error.name // "unknown"' 2>/dev/null || true)"
ERROR_MESSAGE="$(echo "$INPUT" | jq -r '.error.message // ""' 2>/dev/null || true)"
ERROR_STACK="$(echo "$INPUT" | jq -r '.error.stack // ""' 2>/dev/null || true)"

# Portable epoch-to-ISO conversion (GNU date -d vs BSD date -r)
_epoch_to_iso() {
  local epoch_secs="$1"
  if date --version >/dev/null 2>&1; then
    date -u -d "@${epoch_secs}" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "$epoch_secs"
  else
    date -u -r "${epoch_secs}" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "$epoch_secs"
  fi
}

if [ -n "$TIMESTAMP" ] && echo "$TIMESTAMP" | grep -qE '^[0-9]+$'; then
  TS_DISPLAY="$(_epoch_to_iso "$((TIMESTAMP / 1000))")"
elif [ -n "$TIMESTAMP" ]; then
  TS_DISPLAY="$TIMESTAMP"
else
  TS_DISPLAY="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi

# Determine active session ID (if any).
MARKER="$REPO_ROOT/.ejs-session-active"
SESSION_ID=""
if [ -f "$MARKER" ]; then
  JOURNEY_FILE="$(cat "$MARKER")"
  SESSION_ID="$(basename "$JOURNEY_FILE" .md)"
fi

# Append audit record.
LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"

jq -n \
  --arg ts "$TS_DISPLAY" \
  --arg session "$SESSION_ID" \
  --arg name "$ERROR_NAME" \
  --arg msg "$ERROR_MESSAGE" \
  --arg stack "$ERROR_STACK" \
  '{event:"error_occurred",timestamp:$ts,session:$session,errorName:$name,errorMessage:$msg,errorStack:$stack}' \
  >> "$LOG_DIR/ejs-error-audit.jsonl" 2>/dev/null || true

echo "EJS Hook [error-occurred]: logged $ERROR_NAME" >&2
exit 0
