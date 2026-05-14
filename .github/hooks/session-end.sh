#!/usr/bin/env bash
# EJS Hook: sessionEnd
# Validates journey file completeness and writes a validation summary.
# Input (stdin): JSON with timestamp, cwd, reason
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

SEMANTIC_UNRESOLVED_THRESHOLD="${EJS_SEMANTIC_UNRESOLVED_THRESHOLD:-0}"
if ! [[ "$SEMANTIC_UNRESOLVED_THRESHOLD" =~ ^[0-9]+$ ]]; then
  SEMANTIC_UNRESOLVED_THRESHOLD=0
fi

# --- 1. Parse input ---
REASON="$(echo "$INPUT" | jq -r '.reason // "unknown"' 2>/dev/null || true)"

# --- 2. Locate the active journey file ---
MARKER="$REPO_ROOT/.ejs-session-active"
if [ ! -f "$MARKER" ]; then
  echo "EJS Hook [session-end]: no active session marker found — skipping validation" >&2
  exit 0
fi

JOURNEY_FILE="$(cat "$MARKER")"
if [ ! -f "$JOURNEY_FILE" ]; then
  echo "EJS Hook [session-end]: journey file not found at $JOURNEY_FILE" >&2
  exit 0
fi

# --- 3. Validate required sections are non-empty ---
ISSUES=()

check_section() {
  local section_name="$1"
  local pattern="$2"
  # Extract content between this heading and the next heading of same or higher level,
  # filtering out empty lines and common template placeholder patterns.
  local content
  content="$(awk "
    /^#+ ${pattern}/{found=1; next}
    found && /^#+ /{exit}
    found{print}
  " "$JOURNEY_FILE" \
    | grep -vE '^\s*$' \
    | grep -vE '^\s*(Describe |Capture |Recommended format|Do:|Avoid:|Which agents|Key suggestions|Corrections applied|What was|Notable pivots|Technical insights|Prompting insights|Tooling insights|Do this:|Avoid this:|Watch out for:|Prefer:|^- Decision:|^  - Reason:|^  - Impact:)\s*$' \
    | head -5)" || true

  if [ -z "$content" ]; then
    ISSUES+=("$section_name: empty or contains only template placeholders")
  fi
}

check_section "Interaction Summary" "Interaction Summary"
check_section "Decisions Made" "Decisions Made"
check_section "INTERACTION_EXTRACT" "INTERACTION_EXTRACT"
check_section "DECISIONS_EXTRACT" "DECISIONS_EXTRACT"
check_section "LEARNING_EXTRACT" "LEARNING_EXTRACT"

if [ "$SEMANTIC_MODE" != "off" ]; then
  read -r SUBAGENT_TOTAL SUBAGENT_UNRESOLVED < <(
    awk '
      BEGIN {in_block=0; total=0; unresolved=0; unknown=0; placeholder=0; marker=0}
      /^## Sub-Agent:/ {
        in_block=1
        unknown=($0 ~ /^## Sub-Agent: unknown$/)
        placeholder=0
        marker=0
      }
      in_block && /_To be filled by parent agent_/ {placeholder=1}
      in_block && /EJS Semantic: unresolved/ {marker=1}
      in_block && /<!-- Logged by EJS Hook \[subagent-stop\] -->/ {
        total++
        if (unknown || placeholder || marker) {
          unresolved++
        }
        in_block=0
      }
      END {printf "%d %d\n", total, unresolved}
    ' "$JOURNEY_FILE"
  )

  if [ "$SUBAGENT_UNRESOLVED" -gt "$SEMANTIC_UNRESOLVED_THRESHOLD" ]; then
    ISSUES+=("Semantic payloads: ${SUBAGENT_UNRESOLVED}/${SUBAGENT_TOTAL} unresolved sub-agent entries (threshold=${SEMANTIC_UNRESOLVED_THRESHOLD}, mode=${SEMANTIC_MODE})")
  fi
fi

# --- 4. Write validation summary to journey file footer ---
{
  echo ""
  echo "---"
  echo "<!-- EJS Hook Validation (sessionEnd) -->"
  echo "<!-- Reason: $REASON -->"
  echo "<!-- Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ) -->"
  echo "<!-- Semantic mode: $SEMANTIC_MODE -->"
  if [ "$SEMANTIC_MODE" != "off" ]; then
    echo "<!-- Semantic unresolved threshold: $SEMANTIC_UNRESOLVED_THRESHOLD -->"
    echo "<!-- Semantic unresolved entries: ${SUBAGENT_UNRESOLVED:-0}/${SUBAGENT_TOTAL:-0} -->"
  fi
  if [ ${#ISSUES[@]} -eq 0 ]; then
    echo "<!-- Status: COMPLETE — all required sections populated -->"
  else
    echo "<!-- Status: INCOMPLETE — ${#ISSUES[@]} issue(s) found -->"
    for issue in "${ISSUES[@]}"; do
      echo "<!--   - $issue -->"
    done
  fi
  echo "<!-- End EJS Hook Validation -->"
} >> "$JOURNEY_FILE"

# --- 5. Create incomplete marker if issues found ---
if [ ${#ISSUES[@]} -gt 0 ]; then
  echo "$JOURNEY_FILE" > "$REPO_ROOT/.ejs-session-incomplete"
  echo "EJS Hook [session-end]: INCOMPLETE — ${#ISSUES[@]} issue(s) in $JOURNEY_FILE" >&2
else
  # Remove stale incomplete marker if present
  rm -f "$REPO_ROOT/.ejs-session-incomplete"
  echo "EJS Hook [session-end]: COMPLETE — $JOURNEY_FILE validated successfully" >&2
fi

# --- 6. Clean up active session marker ---
rm -f "$MARKER"

exit 0
