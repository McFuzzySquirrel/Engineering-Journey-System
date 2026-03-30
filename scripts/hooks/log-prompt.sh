#!/usr/bin/env bash
# EJS Hook: userPromptSubmitted
# Logs user prompts to a JSONL audit trail.
# Input (stdin): JSON with timestamp, cwd, prompt
# Output: none (ignored by platform)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INPUT="$(cat)"

# --- 1. Parse input ---
TIMESTAMP="$(echo "$INPUT" | jq -r '.timestamp // empty' 2>/dev/null || true)"
PROMPT="$(echo "$INPUT" | jq -r '.prompt // ""' 2>/dev/null || true)"

# Format timestamp
if [ -n "$TIMESTAMP" ] && echo "$TIMESTAMP" | grep -qE '^[0-9]+$'; then
  TS_DISPLAY="$(date -u -d "@$((TIMESTAMP / 1000))" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "$TIMESTAMP")"
elif [ -n "$TIMESTAMP" ]; then
  TS_DISPLAY="$TIMESTAMP"
else
  TS_DISPLAY="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi

# --- 2. Determine active session ID (if any) ---
MARKER="$REPO_ROOT/.ejs-session-active"
SESSION_ID=""
if [ -f "$MARKER" ]; then
  JOURNEY_FILE="$(cat "$MARKER")"
  SESSION_ID="$(basename "$JOURNEY_FILE" .md)"
fi

# --- 3. Append to JSONL audit file ---
LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"

jq -n \
  --arg ts "$TS_DISPLAY" \
  --arg prompt "$PROMPT" \
  --arg session "$SESSION_ID" \
  '{event:"user_prompt",timestamp:$ts,session:$session,prompt:$prompt}' \
  >> "$LOG_DIR/ejs-prompt-audit.jsonl" 2>/dev/null || true

echo "EJS Hook [log-prompt]: logged prompt to audit trail" >&2
exit 0
