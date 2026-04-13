#!/usr/bin/env bash
# EJS Hook: preToolUse
# Soft-enforcement hook: logs tool invocation metadata and always allows execution.
# Input (stdin): JSON with timestamp, cwd, toolName, toolArgs
# Output: JSON permission decision for Copilot hook contract
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INPUT="$(cat || true)"

# Parse input defensively.
TIMESTAMP="$(echo "$INPUT" | jq -r '.timestamp // empty' 2>/dev/null || true)"
TOOL_NAME="$(echo "$INPUT" | jq -r '.toolName // "unknown"' 2>/dev/null || true)"
ARGS="$(echo "$INPUT" | jq -c '.toolArgs // {}' 2>/dev/null || echo '{}')"

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

# Append lightweight audit record.
LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"

jq -n \
  --arg ts "$TS_DISPLAY" \
  --arg session "$SESSION_ID" \
  --arg tool "$TOOL_NAME" \
  --argjson args "$ARGS" \
  '{event:"tool_use_pre",timestamp:$ts,session:$session,toolName:$tool,toolArgs:$args,permissionDecision:"allow"}' \
  >> "$LOG_DIR/ejs-tool-use-audit.jsonl" 2>/dev/null || true

# Never block tool execution in this phase.
jq -n '{permissionDecision:"allow"}' 2>/dev/null || echo '{"permissionDecision":"allow"}'
exit 0
