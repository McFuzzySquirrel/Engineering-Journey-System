#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────
# EJS Bootstrap Script
# Adds the Engineering Journey System to an existing repository.
#
# Usage:
#   From the EJS starter repo:
#     ./scripts/bootstrap-ejs.sh /path/to/target-repo
#
#   Or download and run directly:
#     curl -sL https://raw.githubusercontent.com/McFuzzySquirrel/Engineering-Journey-System/main/scripts/bootstrap-ejs.sh | bash -s -- /path/to/target-repo
#
# What it does:
#   1. Copies the EJS agent profile, agent skills, templates, and tooling
#   2. Appends the EJS Silent Recording Contract to your existing
#      copilot-instructions.md (does NOT replace it)
#
# EJS is additive and non-competing — it layers silent collaboration
# recording onto whatever agents you already have.
# ─────────────────────────────────────────────────────────────────────

# ── Resolve EJS source directory ────────────────────────────────────

# If piped via curl, we need to clone the starter repo to a temp dir.
# If run from a local clone, use the repo root.
EJS_SOURCE=""
TEMP_DIR=""

resolve_source() {
  # Check if we're inside the EJS starter repo
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

  if [[ -f "$script_dir/../.github/agents/ejs-journey.agent.md" ]]; then
    EJS_SOURCE="$(cd "$script_dir/.." && pwd)"
  elif [[ -f "$PWD/.github/agents/ejs-journey.agent.md" ]]; then
    EJS_SOURCE="$PWD"
  else
    echo "EJS: Cloning starter repo to temporary directory..."
    TEMP_DIR="$(mktemp -d)"
    git clone --depth 1 https://github.com/McFuzzySquirrel/Engineering-Journey-System.git "$TEMP_DIR" 2>/dev/null
    EJS_SOURCE="$TEMP_DIR"
  fi
}

cleanup() {
  if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
    rm -rf "$TEMP_DIR"
  fi
}
trap cleanup EXIT

# ── Parse arguments ─────────────────────────────────────────────────

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS] <target-repo>

Bootstrap the Engineering Journey System into an existing repository.

Arguments:
  <target-repo>    Path to the target repository (must be a git repo)

Options:
  --with-pr        Also copy the PR template
  --full           Copy everything (PR template)
  --dry-run        Show what would be done without making changes
  -h, --help       Show this help message

Tiers:
  Tier 1 (always-on) activates automatically after bootstrap — every
  agent in the repo silently records to Session Journey files.

  Tier 2 (bookend) requires the agent profile — invoke @ejs-journey
  at session start/end.

  Tier 3 (coordinator) requires the agent profile — select ejs-journey
  from the agent dropdown for full-session coordination.
EOF
  exit 0
}

TARGET=""
WITH_PR=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-hooks) shift ;;  # ignored — git hooks removed; Copilot hooks handle this now
    --with-db)    shift ;;  # ignored — database tool is now always included
    --with-pr)    WITH_PR=true; shift ;;
    --full)       WITH_PR=true; shift ;;
    --dry-run)    DRY_RUN=true; shift ;;
    -h|--help)    usage ;;
    -*)           echo "EJS: unknown option: $1"; usage ;;
    *)            TARGET="$1"; shift ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  echo "EJS: error — target repository path is required."
  echo ""
  usage
fi

# ── Validate target ─────────────────────────────────────────────────

TARGET="$(cd "$TARGET" 2>/dev/null && pwd || echo "$TARGET")"

if [[ ! -d "$TARGET" ]]; then
  echo "EJS: error — target directory does not exist: $TARGET"
  exit 1
fi

if ! git -C "$TARGET" rev-parse --git-dir >/dev/null 2>&1; then
  echo "EJS: error — target is not a git repository: $TARGET"
  exit 1
fi

# ── Resolve source ──────────────────────────────────────────────────

resolve_source

echo "EJS: bootstrapping into $TARGET"
echo "EJS: source: $EJS_SOURCE"
echo ""

# ── Helper: copy file ──────────────────────────────────────────────

copy_file() {
  local src="$1"
  local dest="$2"
  local label="${3:-$dest}"

  if [[ "$DRY_RUN" == true ]]; then
    if [[ -f "$TARGET/$dest" ]]; then
      echo "  [skip] $label (already exists)"
    else
      echo "  [copy] $label"
    fi
    return
  fi

  if [[ -f "$TARGET/$dest" ]]; then
    echo "  [skip] $label (already exists)"
    return
  fi

  mkdir -p "$TARGET/$(dirname "$dest")"
  cp "$EJS_SOURCE/$src" "$TARGET/$dest"
  echo "  [done] $label"
}

# ── Helper: append to copilot-instructions.md ───────────────────────

append_recording_contract() {
  local target_file="$TARGET/.github/copilot-instructions.md"
  local source_file="$EJS_SOURCE/.github/copilot-instructions.md"
  local marker="## EJS Recording Contract"

  if [[ "$DRY_RUN" == true ]]; then
    if [[ -f "$target_file" ]] && grep -qF "$marker" "$target_file" 2>/dev/null; then
      echo "  [skip] .github/copilot-instructions.md (EJS block already present)"
    elif [[ -f "$target_file" ]]; then
      echo "  [append] EJS Recording Contract (micro-instruction) → .github/copilot-instructions.md"
    else
      echo "  [create] .github/copilot-instructions.md (with EJS recording contract)"
    fi
    return
  fi

  mkdir -p "$TARGET/.github"

  # If the file already has the EJS block, skip
  if [[ -f "$target_file" ]] && grep -qF "$marker" "$target_file" 2>/dev/null; then
    echo "  [skip] .github/copilot-instructions.md (EJS block already present)"
    return
  fi

  # Extract just the recording contract block (from --- onwards)
  local contract
  contract="$(sed -n '/^---$/,$ p' "$source_file")"

  if [[ -f "$target_file" ]]; then
    # Append to existing file
    printf '\n\n%s\n' "$contract" >> "$target_file"
    echo "  [done] Appended EJS Recording Contract (micro-instruction) to .github/copilot-instructions.md"
  else
    # Create new file with the full contents
    cp "$source_file" "$target_file"
    echo "  [done] Created .github/copilot-instructions.md (with EJS recording contract)"
  fi
}

# ── Core files (always copied) ──────────────────────────────────────

echo "Core files:"
copy_file ".github/agents/ejs-journey.agent.md" ".github/agents/ejs-journey.agent.md" "Agent profile (.github/agents/ejs-journey.agent.md)"
append_recording_contract
copy_file ".github/skills/ejs-session-init/SKILL.md" ".github/skills/ejs-session-init/SKILL.md" "Agent skill (.github/skills/ejs-session-init/SKILL.md)"
copy_file ".github/skills/ejs-session-wrapup/SKILL.md" ".github/skills/ejs-session-wrapup/SKILL.md" "Agent skill (.github/skills/ejs-session-wrapup/SKILL.md)"
copy_file ".github/skills/ejs-sub-agent-capture/SKILL.md" ".github/skills/ejs-sub-agent-capture/SKILL.md" "Agent skill (.github/skills/ejs-sub-agent-capture/SKILL.md)"
copy_file ".github/skills/ejs-story-builder/SKILL.md" ".github/skills/ejs-story-builder/SKILL.md" "Agent skill (.github/skills/ejs-story-builder/SKILL.md)"
copy_file ".github/skills/ejs-story-builder/assets/narrative-template.md" ".github/skills/ejs-story-builder/assets/narrative-template.md" "Story template (.github/skills/ejs-story-builder/assets/narrative-template.md)"
copy_file ".github/skills/arch-blueprint/SKILL.md" ".github/skills/arch-blueprint/SKILL.md" "Agent skill (.github/skills/arch-blueprint/SKILL.md)"
copy_file ".github/skills/readme-updater/SKILL.md" ".github/skills/readme-updater/SKILL.md" "Agent skill (.github/skills/readme-updater/SKILL.md)"
copy_file "ejs-docs/journey/_templates/journey-template.md" "ejs-docs/journey/_templates/journey-template.md" "Journey template (ejs-docs/journey/_templates/journey-template.md)"
copy_file "ejs-docs/adr/0000-adr-template.md" "ejs-docs/adr/0000-adr-template.md" "ADR template (ejs-docs/adr/0000-adr-template.md)"
copy_file "ejs-docs/architecture/_templates/arch-blueprint-template.md" "ejs-docs/architecture/_templates/arch-blueprint-template.md" "Architecture Blueprint template (ejs-docs/architecture/_templates/arch-blueprint-template.md)"
copy_file "ejs-docs/architecture/_templates/readme-template.md" "ejs-docs/architecture/_templates/readme-template.md" "README template (ejs-docs/architecture/_templates/readme-template.md)"
copy_file "ejs-docs/knowledge-graph/graph-schema.md" "ejs-docs/knowledge-graph/graph-schema.md" "Knowledge graph schema (ejs-docs/knowledge-graph/graph-schema.md)"
copy_file "ejs-docs/knowledge-graph/index.json" "ejs-docs/knowledge-graph/index.json" "Knowledge graph index (ejs-docs/knowledge-graph/index.json)"
copy_file "scripts/adr-db.py" "scripts/adr-db.py" "adr-db.py (scripts/adr-db.py)"
copy_file "scripts/knowledge-graph.py" "scripts/knowledge-graph.py" "knowledge-graph.py (scripts/knowledge-graph.py)"
copy_file "scripts/tests/test_adr_db.py" "scripts/tests/test_adr_db.py" "Tests (scripts/tests/test_adr_db.py)"
copy_file "scripts/tests/test_knowledge_graph.py" "scripts/tests/test_knowledge_graph.py" "Tests (scripts/tests/test_knowledge_graph.py)"
echo ""

# ── Copilot hooks (Layer 0 — guaranteed structural automation) ──────

echo "Copilot hooks (Layer 0):"
copy_file ".github/hooks/ejs-hooks.json" ".github/hooks/ejs-hooks.json" "Hook config (.github/hooks/ejs-hooks.json)"
copy_file ".github/hooks/session-start.sh" ".github/hooks/session-start.sh" "Hook script (.github/hooks/session-start.sh)"
copy_file ".github/hooks/session-end.sh" ".github/hooks/session-end.sh" "Hook script (.github/hooks/session-end.sh)"
copy_file ".github/hooks/subagent-stop.sh" ".github/hooks/subagent-stop.sh" "Hook script (.github/hooks/subagent-stop.sh)"
copy_file ".github/hooks/log-prompt.sh" ".github/hooks/log-prompt.sh" "Hook script (.github/hooks/log-prompt.sh)"
copy_file ".github/hooks/pre-commit-doc-check.sh" ".github/hooks/pre-commit-doc-check.sh" "Hook script (.github/hooks/pre-commit-doc-check.sh)"

# Make hook scripts executable
if [[ "$DRY_RUN" != true ]]; then
  chmod +x "$TARGET/.github/hooks/"*.sh 2>/dev/null || true
fi

# ── Install git pre-commit hook ────────────────────────────────────────
# The pre-commit-doc-check script also runs as a standard git hook so it
# works outside Copilot environments (e.g., local CLI commits).

install_git_precommit() {
  local git_hook_dir
  git_hook_dir="$(git -C "$TARGET" rev-parse --git-dir 2>/dev/null)/hooks"

  if [[ "$DRY_RUN" == true ]]; then
    echo "  [install] git pre-commit hook → $git_hook_dir/pre-commit"
    return
  fi

  mkdir -p "$git_hook_dir"
  local hook_file="$git_hook_dir/pre-commit"

  if [[ -f "$hook_file" ]]; then
    # Check if our hook is already installed
    if grep -qF "pre-commit-doc-check" "$hook_file" 2>/dev/null; then
      echo "  [skip] git pre-commit hook (EJS hook already present)"
      return
    fi
    # Append to existing hook
    printf '\n# EJS: doc freshness check\nbash "$(git rev-parse --show-toplevel)/.github/hooks/pre-commit-doc-check.sh"\n' >> "$hook_file"
    echo "  [done] Appended EJS doc-check to existing git pre-commit hook"
  else
    # Create a new hook
    cat > "$hook_file" << 'HOOK'
#!/usr/bin/env bash
# EJS pre-commit: doc freshness check
bash "$(git rev-parse --show-toplevel)/.github/hooks/pre-commit-doc-check.sh"
HOOK
    chmod +x "$hook_file"
    echo "  [done] Installed git pre-commit hook ($hook_file)"
  fi
}

install_git_precommit

# Create logs directory for audit JSONL files
if [[ "$DRY_RUN" != true ]]; then
  mkdir -p "$TARGET/logs"
  if [[ ! -f "$TARGET/logs/.gitkeep" ]]; then
    touch "$TARGET/logs/.gitkeep"
    echo "  [done] Created logs/.gitkeep"
  fi
else
  echo "  [create] logs/.gitkeep"
fi
echo ""

# Add .ejs.db, session markers, and audit logs to .gitignore
if [[ "$DRY_RUN" != true ]]; then
  if [[ -f "$TARGET/.gitignore" ]]; then
    for entry in ".ejs.db" ".ejs-session-active" ".ejs-session-incomplete" "logs/*.jsonl"; do
      if ! grep -qF "$entry" "$TARGET/.gitignore" 2>/dev/null; then
        echo "$entry" >> "$TARGET/.gitignore"
        echo "  [done] Added $entry to .gitignore"
      fi
    done
  else
    printf '.ejs.db\n.ejs-session-active\n.ejs-session-incomplete\nlogs/*.jsonl\n' > "$TARGET/.gitignore"
    echo "  [done] Created .gitignore with EJS entries"
  fi
else
  echo "  [append] .ejs.db, .ejs-session-active, .ejs-session-incomplete, logs/*.jsonl → .gitignore"
fi
echo ""

# ── Optional: PR template ──────────────────────────────────────────

if [[ "$WITH_PR" == true ]]; then
  echo "PR template:"
  copy_file ".github/copilot/pull_request_template.md" ".github/copilot/pull_request_template.md" "PR template (.github/copilot/pull_request_template.md)"
  echo ""
fi

# ── Summary ─────────────────────────────────────────────────────────

if [[ "$DRY_RUN" == true ]]; then
  echo "─── Dry run complete (no changes made) ───"
  echo ""
  echo "Run without --dry-run to apply changes."
else
  echo "─── EJS bootstrap complete ───"
  echo ""
  echo "What happens now:"
  echo "  • Layer 0 (hooks): Copilot hooks automatically create journey files,"
  echo "    sync the database and knowledge graph, validate completeness, and log sub-agent events."
  echo "  • Pre-commit hook: warns when living docs (Architecture Blueprint, README, ADRs)"
  echo "    are stale and not part of the staged commit (non-blocking)."
  echo "  • Tier 1 (always-on): Active immediately — every Copilot agent"
  echo "    in this repo will silently record to Session Journey files."
  echo "    Agent skills auto-load for session init, wrap-up, and sub-agent capture."
  echo "  • Tier 2 (bookend): Say '@ejs-journey initialize session' to start"
  echo "    and '@ejs-journey finalize session' to end."
  echo "  • Tier 3 (coordinator): Select ejs-journey from the agent dropdown."
  echo ""
  echo "Next steps:"
  echo "  1. Update ejs-docs/architecture/architecture-blueprint.md for your project"
  echo "  2. python scripts/knowledge-graph.py sync   (rebuild index)"
  echo "  3. git add -A && git commit -m 'chore: bootstrap EJS'"
  echo "  4. Merge to default branch (hooks activate from default branch only)"
  echo "  5. Start working — EJS records automatically"
fi
