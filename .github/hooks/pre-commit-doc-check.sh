#!/usr/bin/env bash
# EJS Hook: pre-commit-doc-check
#
# Warns when living documents (Architecture Blueprint, README, ADRs) are stale
# relative to recent commits and are not part of the current staged commit.
#
# This script is NON-BLOCKING — it emits warnings but always exits 0 so it
# never prevents a commit.
#
# It is invoked in two ways:
#   1. As a Copilot hook (registered in ejs-hooks.json under "preCommit")
#   2. As a standard git pre-commit hook (.git/hooks/pre-commit),
#      installed by scripts/bootstrap-ejs.sh
#
# Configuration (via environment variables):
#   EJS_STALENESS_DAYS  — days before a doc is considered stale (default: 7)
#   EJS_NO_DOC_CHECK    — set to "1" to disable this hook entirely

set -euo pipefail

# Allow opt-out
if [[ "${EJS_NO_DOC_CHECK:-0}" == "1" ]]; then
  exit 0
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STALENESS_DAYS="${EJS_STALENESS_DAYS:-7}"

# ── Paths to the three living documents ────────────────────────────────────
BLUEPRINT="ejs-docs/architecture/architecture-blueprint.md"
README_FILE="README.md"
ADR_DIR="ejs-docs/adr"

# ── Skill links ─────────────────────────────────────────────────────────────
SKILL_BLUEPRINT=".github/skills/arch-blueprint/SKILL.md"
SKILL_README=".github/skills/readme-updater/SKILL.md"
SKILL_ADR=".github/skills/ejs-session-wrapup/SKILL.md"

# ── Helpers ──────────────────────────────────────────────────────────────────

# Days since a file was last modified (git log date or file mtime)
_days_since_modified() {
  local rel_path="$1"
  local abs_path="$REPO_ROOT/$rel_path"

  # Prefer git log (committed date)
  local last_commit_ts
  last_commit_ts="$(git -C "$REPO_ROOT" log -1 --format="%ct" -- "$rel_path" 2>/dev/null || echo "")"

  if [[ -n "$last_commit_ts" && "$last_commit_ts" -gt 0 ]]; then
    local now_ts
    now_ts="$(date +%s)"
    echo $(( (now_ts - last_commit_ts) / 86400 ))
    return
  fi

  # Fall back to filesystem mtime
  if [[ -f "$abs_path" ]]; then
    if stat --version >/dev/null 2>&1; then
      # GNU stat
      local mtime
      mtime="$(stat -c %Y "$abs_path" 2>/dev/null || echo 0)"
    else
      # BSD stat (macOS)
      local mtime
      mtime="$(stat -f %m "$abs_path" 2>/dev/null || echo 0)"
    fi
    local now_ts
    now_ts="$(date +%s)"
    echo $(( (now_ts - mtime) / 86400 ))
    return
  fi

  # File doesn't exist — treat as maximally stale
  echo 9999
}

# Check if a path is in the currently staged commit
_is_staged() {
  local rel_path="$1"
  git -C "$REPO_ROOT" diff --cached --name-only 2>/dev/null | grep -qF "$rel_path"
}

# Check if any file under a directory is staged
_dir_has_staged() {
  local rel_dir="$1"
  git -C "$REPO_ROOT" diff --cached --name-only 2>/dev/null | grep -qE "^${rel_dir}/"
}

# ── Check each living document ───────────────────────────────────────────────

WARNINGS=()

# 1. Architecture Blueprint
if _is_staged "$BLUEPRINT"; then
  : # being updated in this commit — no warning
elif [[ ! -f "$REPO_ROOT/$BLUEPRINT" ]]; then
  WARNINGS+=("📐 Architecture Blueprint (missing)\n     → Run skill: $SKILL_BLUEPRINT\n     → Or create: $BLUEPRINT (template: ejs-docs/architecture/_templates/arch-blueprint-template.md)")
else
  DAYS=$(_days_since_modified "$BLUEPRINT")
  if [[ "$DAYS" -ge "$STALENESS_DAYS" ]]; then
    WARNINGS+=("📐 Architecture Blueprint (last updated ${DAYS} day(s) ago)\n     → Run skill: $SKILL_BLUEPRINT\n     → Or update manually: $BLUEPRINT")
  fi
fi

# 2. README
if _is_staged "$README_FILE"; then
  : # being updated — no warning
elif [[ ! -f "$REPO_ROOT/$README_FILE" ]]; then
  WARNINGS+=("📄 README (missing)\n     → Run skill: $SKILL_README\n     → Or create: README.md (template: ejs-docs/architecture/_templates/readme-template.md)")
else
  DAYS=$(_days_since_modified "$README_FILE")
  if [[ "$DAYS" -ge "$STALENESS_DAYS" ]]; then
    WARNINGS+=("📄 README (last updated ${DAYS} day(s) ago)\n     → Run skill: $SKILL_README\n     → Or update manually: README.md")
  fi
fi

# 3. ADRs — check whether any ADR has been created or updated recently;
#    warn if there are recent session journeys but no recent ADR activity.
if _dir_has_staged "$ADR_DIR"; then
  : # ADRs are being updated — no warning
else
  # Find the most recently modified ADR (excluding the template)
  LATEST_ADR_DAYS=9999
  if [[ -d "$REPO_ROOT/$ADR_DIR" ]]; then
    while IFS= read -r adr_file; do
      [[ "$adr_file" == *"0000-adr-template"* ]] && continue
      rel="$(realpath --relative-to="$REPO_ROOT" "$adr_file" 2>/dev/null || echo "")"
      [[ -z "$rel" ]] && continue
      D=$(_days_since_modified "$rel")
      if [[ "$D" -lt "$LATEST_ADR_DAYS" ]]; then
        LATEST_ADR_DAYS="$D"
      fi
    done < <(find "$REPO_ROOT/$ADR_DIR" -maxdepth 1 -name "*.md" 2>/dev/null)
  fi

  if [[ "$LATEST_ADR_DAYS" -ge "$STALENESS_DAYS" ]]; then
    if [[ "$LATEST_ADR_DAYS" -eq 9999 ]]; then
      MSG="📋 ADRs (no ADRs found)"
    else
      MSG="📋 ADRs (last ADR updated ${LATEST_ADR_DAYS} day(s) ago)"
    fi
    WARNINGS+=("${MSG}\n     → Run skill: $SKILL_ADR (step 4 — ADR decision rubric)\n     → Or create manually: $ADR_DIR/ (use template ejs-docs/adr/0000-adr-template.md)")
  fi
fi

# ── Emit warnings ────────────────────────────────────────────────────────────

if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  echo ""
  echo "⚠️  EJS Doc Check: The following living documents may need updating:"
  echo ""
  for w in "${WARNINGS[@]}"; do
    printf "  %b\n\n" "$w"
  done
  echo "  To suppress: set EJS_NO_DOC_CHECK=1 or update the documents before committing."
  echo ""

  # Write a machine-readable nudge to the logs directory (for agents to read)
  LOG_DIR="$REPO_ROOT/logs"
  if [[ -d "$LOG_DIR" ]]; then
    LOG_FILE="$LOG_DIR/doc-check-$(date -u +%Y%m%dT%H%M%SZ).json"
    {
      printf '{"timestamp":"%s","hook":"pre-commit-doc-check","stale_docs":[' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      first=true
      for w in "${WARNINGS[@]}"; do
        # Extract just the doc name (first word after the emoji)
        doc_name="$(echo "$w" | grep -oE '(Architecture Blueprint|README|ADRs)' | head -1 || echo "unknown")"
        if [[ "$first" == true ]]; then first=false; else printf ','; fi
        printf '"%s"' "$doc_name"
      done
      printf ']}\n'
    } > "$LOG_FILE" 2>/dev/null || true
  fi
fi

# Always exit 0 — this hook is advisory, not blocking
exit 0
