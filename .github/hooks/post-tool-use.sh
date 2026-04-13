#!/usr/bin/env bash
# EJS Hook: postToolUse
# Logs post-tool execution metadata and result status.
# Input (stdin): JSON with timestamp, cwd, toolName, toolArgs, toolResult
# Output: none (ignored by platform)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INPUT="$(cat || true)"

# Parse input defensively.
TIMESTAMP="$(echo "$INPUT" | jq -r '.timestamp // empty' 2>/dev/null || true)"
TOOL_NAME="$(echo "$INPUT" | jq -r '.toolName // "unknown"' 2>/dev/null || true)"
RESULT_TYPE="$(echo "$INPUT" | jq -r '.toolResult.resultType // "unknown"' 2>/dev/null || true)"
TEXT_LEN="$(echo "$INPUT" | jq -r '(.toolResult.textResultForLlm // "") | length' 2>/dev/null || echo 0)"

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
  --arg tool "$TOOL_NAME" \
  --arg result "$RESULT_TYPE" \
  --argjson len "$TEXT_LEN" \
  '{event:"tool_use_post",timestamp:$ts,session:$session,toolName:$tool,resultType:$result,textResultLength:$len}' \
  >> "$LOG_DIR/ejs-tool-use-audit.jsonl" 2>/dev/null || true

echo "EJS Hook [post-tool-use]: logged $TOOL_NAME ($RESULT_TYPE)" >&2
exit 0
