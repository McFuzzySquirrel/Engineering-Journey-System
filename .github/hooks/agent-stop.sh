#!/usr/bin/env bash
# EJS Hook: agentStop
# Logs main agent response boundaries to JSONL audit trail.
# Input (stdin): JSON payload from Copilot agentStop event
# Output: none (ignored by platform)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INPUT="$(cat || true)"

# Parse input defensively.
TIMESTAMP="$(echo "$INPUT" | jq -r '.timestamp // empty' 2>/dev/null || true)"
AGENT_NAME="$(echo "$INPUT" | jq -r '.agentName // .agent_name // "unknown"' 2>/dev/null || true)"

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
  --arg agent "$AGENT_NAME" \
  '{event:"agent_stop",timestamp:$ts,session:$session,agent:$agent}' \
  >> "$LOG_DIR/ejs-agent-audit.jsonl" 2>/dev/null || true

echo "EJS Hook [agent-stop]: logged agent boundary for $AGENT_NAME" >&2
exit 0
