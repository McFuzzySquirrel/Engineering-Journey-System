#!/usr/bin/env bash
# EJS Hook: subagentStop
# Logs sub-agent completion events to the journey file.
# Input (stdin): JSON with sub-agent event details
# Output: none (ignored by platform)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INPUT="$(cat)"

SEMANTIC_MODE="${EJS_SEMANTIC_ENFORCEMENT_MODE:-off}"
SEMANTIC_MODE="$(printf '%s' "$SEMANTIC_MODE" | tr '[:upper:]' '[:lower:]')"
case "$SEMANTIC_MODE" in
  off|soft|strict) ;;
  *) SEMANTIC_MODE="off" ;;
esac

PLACEHOLDER_TOKEN="_To be filled by parent agent_"

# --- 1. Parse input (defensive — fields may be absent or schema may evolve) ---
TIMESTAMP="$(echo "$INPUT" | jq -r '.timestamp // empty' 2>/dev/null || true)"
AGENT_NAME="$(echo "$INPUT" | jq -r '.agentName // .agent_name // "unknown"' 2>/dev/null || true)"
TASK_DESC="$(echo "$INPUT" | jq -r '.taskDescription // .task // ""' 2>/dev/null || true)"
DECISIONS_MADE="$(echo "$INPUT" | jq -r '.decisionsMade // .decisions // ""' 2>/dev/null || true)"
RATIONALE="$(echo "$INPUT" | jq -r '.rationale // ""' 2>/dev/null || true)"
ALTERNATIVES="$(echo "$INPUT" | jq -r '.alternativesConsidered // .alternatives // ""' 2>/dev/null || true)"
OUTCOME="$(echo "$INPUT" | jq -r '.outcome // ""' 2>/dev/null || true)"
HANDOFF_TO="$(echo "$INPUT" | jq -r '.handoffTo // .handoff_to // "none"' 2>/dev/null || true)"

# Format timestamp for human readability (portable: GNU date -d vs BSD date -r)
_epoch_to_iso() {
  local epoch_secs="$1"
  if date --version >/dev/null 2>&1; then
    date -u -d "@${epoch_secs}" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "$epoch_secs"
  else
    date -u -r "${epoch_secs}" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "$epoch_secs"
  fi
}

if [ -n "$TIMESTAMP" ]; then
  # Timestamps may be epoch millis; convert to ISO if numeric
  if echo "$TIMESTAMP" | grep -qE '^[0-9]+$'; then
    TS_DISPLAY="$(_epoch_to_iso "$((TIMESTAMP / 1000))")"
  else
    TS_DISPLAY="$TIMESTAMP"
  fi
else
  TS_DISPLAY="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi

# --- 2. Locate the active journey file ---
MARKER="$REPO_ROOT/.ejs-session-active"
if [ ! -f "$MARKER" ]; then
  echo "EJS Hook [subagent-stop]: no active session marker — skipping" >&2
  exit 0
fi

JOURNEY_FILE="$(cat "$MARKER")"
if [ ! -f "$JOURNEY_FILE" ]; then
  echo "EJS Hook [subagent-stop]: journey file not found — skipping" >&2
  exit 0
fi

# --- 3. Validate semantic payload (mode-dependent) ---
trim_text() {
  local text="$1"
  printf '%s' "$text" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

is_placeholder_value() {
  local text
  text="$(trim_text "$1" | tr '[:upper:]' '[:lower:]')"
  [ -z "$text" ] && return 0
  case "$text" in
    "unknown"|"n/a"|"none"|"_to be filled by parent agent_"|"to be filled by parent agent")
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

has_meaningful_text() {
  local text
  text="$(trim_text "$1")"
  if is_placeholder_value "$text"; then
    return 1
  fi
  [ "${#text}" -ge 8 ]
}

SESSION_ID="$(basename "$JOURNEY_FILE" .md)"
VIOLATIONS=()

if [ "$SEMANTIC_MODE" != "off" ]; then
  if ! has_meaningful_text "$AGENT_NAME"; then
    VIOLATIONS+=("agent_name_missing")
  fi
  if ! has_meaningful_text "$TASK_DESC"; then
    VIOLATIONS+=("task_missing")
  fi
  if ! has_meaningful_text "$DECISIONS_MADE"; then
    VIOLATIONS+=("decisions_missing")
  fi
  if ! has_meaningful_text "$RATIONALE"; then
    VIOLATIONS+=("rationale_missing")
  fi
  if ! has_meaningful_text "$OUTCOME"; then
    VIOLATIONS+=("outcome_missing")
  fi

  ALT_TRIM="$(trim_text "$ALTERNATIVES")"
  ALT_LOWER="$(printf '%s' "$ALT_TRIM" | tr '[:upper:]' '[:lower:]')"
  if ! has_meaningful_text "$ALTERNATIVES" && [[ "$ALT_LOWER" != none_with_reason:* ]]; then
    VIOLATIONS+=("alternatives_missing")
  fi
fi

SEMANTIC_STATUS="pass"
if [ "$SEMANTIC_MODE" = "soft" ] && [ ${#VIOLATIONS[@]} -gt 0 ]; then
  SEMANTIC_STATUS="warn"
fi
if [ "$SEMANTIC_MODE" = "strict" ] && [ ${#VIOLATIONS[@]} -gt 0 ]; then
  SEMANTIC_STATUS="fail"
fi

VIOLATION_SUMMARY="none"
if [ ${#VIOLATIONS[@]} -gt 0 ]; then
  VIOLATION_SUMMARY="$(IFS=','; echo "${VIOLATIONS[*]}")"
fi

# --- 4. Append sub-agent entry to journey ---
if [ "$SEMANTIC_MODE" = "off" ]; then
  {
    echo ""
    echo "## Sub-Agent: ${AGENT_NAME}"
    echo "- **Timestamp:** ${TS_DISPLAY}"
    echo "- **Task delegated:** ${TASK_DESC:-$PLACEHOLDER_TOKEN}"
    echo "- **Decisions made:** $PLACEHOLDER_TOKEN"
    echo "- **Alternatives considered:** $PLACEHOLDER_TOKEN"
    echo "- **Outcome:** $PLACEHOLDER_TOKEN"
    echo "- **Handoff to other agents:** $PLACEHOLDER_TOKEN"
    echo "<!-- Logged by EJS Hook [subagent-stop] -->"
  } >> "$JOURNEY_FILE"
elif [ "$SEMANTIC_STATUS" = "pass" ]; then
  {
    echo ""
    echo "## Sub-Agent: ${AGENT_NAME}"
    echo "- **Timestamp:** ${TS_DISPLAY}"
    echo "- **Task delegated:** ${TASK_DESC}"
    echo "- **Decisions made:** ${DECISIONS_MADE}"
    echo "- **Rationale:** ${RATIONALE}"
    echo "- **Alternatives considered:** ${ALTERNATIVES}"
    echo "- **Outcome:** ${OUTCOME}"
    echo "- **Handoff to other agents:** ${HANDOFF_TO:-none}"
    echo "- **Semantic enforcement status:** pass (mode=${SEMANTIC_MODE})"
    echo "<!-- EJS Semantic: resolved -->"
    echo "<!-- Logged by EJS Hook [subagent-stop] -->"
  } >> "$JOURNEY_FILE"
else
  {
    echo ""
    echo "## Sub-Agent: ${AGENT_NAME:-unknown}"
    echo "- **Timestamp:** ${TS_DISPLAY}"
    echo "- **Task delegated:** ${TASK_DESC:-$PLACEHOLDER_TOKEN}"
    echo "- **Decisions made:** $PLACEHOLDER_TOKEN"
    echo "- **Rationale:** $PLACEHOLDER_TOKEN"
    echo "- **Alternatives considered:** $PLACEHOLDER_TOKEN"
    echo "- **Outcome:** $PLACEHOLDER_TOKEN"
    echo "- **Handoff to other agents:** ${HANDOFF_TO:-$PLACEHOLDER_TOKEN}"
    echo "- **Semantic enforcement status:** ${SEMANTIC_STATUS} (mode=${SEMANTIC_MODE})"
    echo "- **Semantic violations:** ${VIOLATION_SUMMARY}"
    echo "<!-- EJS Semantic: unresolved -->"
    echo "<!-- Logged by EJS Hook [subagent-stop] -->"
  } >> "$JOURNEY_FILE"
fi

# --- 5. Log to JSONL audit file ---
LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"

jq -n \
  --arg ts "$TS_DISPLAY" \
  --arg agent "$AGENT_NAME" \
  --arg task "$TASK_DESC" \
  --arg session "$SESSION_ID" \
  --arg journey "$(basename "$JOURNEY_FILE")" \
  --arg mode "$SEMANTIC_MODE" \
  --arg status "$SEMANTIC_STATUS" \
  --arg violations "$VIOLATION_SUMMARY" \
  '{event:"subagent_stop",timestamp:$ts,session:$session,agent:$agent,task:$task,journey:$journey,semantic_mode:$mode,enforcement_status:$status,violations:$violations}' \
  >> "$LOG_DIR/ejs-subagent-audit.jsonl" 2>/dev/null || true

echo "EJS Hook [subagent-stop]: logged ${AGENT_NAME} event to $JOURNEY_FILE (mode=$SEMANTIC_MODE status=$SEMANTIC_STATUS)" >&2
exit 0
