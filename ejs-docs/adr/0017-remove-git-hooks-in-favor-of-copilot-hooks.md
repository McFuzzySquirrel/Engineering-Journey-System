---
ejs:
  type: journey-adr
  version: 1.1
  adr_id: "0017"
  title: Remove Git Hooks in Favor of Copilot Hooks
  date: 2026-04-08
  status: accepted
  session_id: ejs-session-2026-04-08-02
  session_journey: ejs-docs/journey/2026/ejs-session-2026-04-08-02.md

actors:
  humans:
    - id: McFuzzySquirrel
      role: system owner
  agents:
    - id: GitHub Copilot (Claude Opus 4.6)
      role: implementation agent

context:
  repo: Engineering-Journey-System
  branch: chore/fix-hooks
---

# Session Journey

Link to the originating session artifact:
- Session Journey: `ejs-docs/journey/2026/ejs-session-2026-04-08-02.md`

# Context

EJS previously included two separate hook systems:

1. **Git hooks** (`.githooks/post-commit`, `.githooks/pre-push`) — developer-facing reminders that warned when a commit or push didn't include a Session Journey file. Required manual installation via `scripts/install-githooks.sh` or `scripts/install-githooks.ps1`.

2. **Copilot hooks** (`.github/hooks/ejs-hooks.json` + shell scripts) — platform-managed automation (Layer 0) that deterministically handles DB sync, journey file scaffold creation, completeness validation, sub-agent logging, and prompt audit. Activated automatically from the default branch with no manual installation.

With the adoption of Copilot hooks (ADR 0016), the git hooks' value proposition narrowed significantly. Copilot hooks guarantee the journey file exists (session-start), validate completeness (session-end), and log sub-agent events (subagent-stop) — all deterministically and without manual setup. The git hooks only provided commit/push-time reminders for something that is now structurally guaranteed.

---

# Session Intent

Simplify the EJS stack by removing the git hook system, since EJS is designed exclusively for Copilot-based workflows and Copilot hooks fully supersede the git hooks' functionality.

# Collaboration Summary

Analysis compared the three automation systems (Copilot hooks, git hooks, wrapup skill). The wrapup skill was confirmed as still necessary — it provides semantic finalization (ADR evaluation, machine extracts) that hooks cannot perform. Git hooks were identified as redundant: their sole function (commit/push reminders) is superseded by Copilot hooks that guarantee journey file creation and validation automatically.

---

# Decision Trigger / Significance

This decision changes the engineering process by removing an installation step and simplifying the bootstrap scripts. It also narrows the system's scope to Copilot-only workflows, which is a deliberate architectural boundary.

# Considered Options

## Option A: Keep git hooks as a safety net
Retain the git hooks alongside Copilot hooks for defense-in-depth. They catch the edge case where someone commits without the Copilot agent active (e.g., CLI-only workflow).

## Option B: Remove git hooks entirely (chosen)
Remove all git hook files, install scripts, and references. EJS is exclusively for recording Copilot interactions and is only meant to be used with Copilot workflows. Non-Copilot workflows don't need journey file reminders.

## Option C: Convert git hooks to Copilot-aware checks
Modify git hooks to check for `.ejs-session-active` marker instead of journey files. Adds complexity for minimal benefit since Copilot hooks already handle this.

---

# Decision

Remove all git hooks (`.githooks/post-commit`, `.githooks/pre-push`) and their install scripts (`scripts/install-githooks.sh`, `scripts/install-githooks.ps1`). Remove all references from bootstrap scripts and documentation. EJS relies exclusively on Copilot hooks (Layer 0) for structural automation.

---

# Rationale

- **Redundancy:** Copilot hooks guarantee journey file creation at session start and validate completeness at session end — both deterministically. Git hooks only reminded developers after the fact.
- **Installation friction:** Git hooks required manual installation (`install-githooks.sh`). Copilot hooks activate automatically from the default branch.
- **Scope alignment:** EJS exists to capture Copilot interactions. Non-Copilot workflows are out of scope. Maintaining infrastructure for them adds complexity without value.
- **Simplification:** Fewer files, fewer bootstrap flags (`--with-hooks`), simpler documentation. Aligns with the simplification direction in ADR 0015.
- **Backward compatibility:** The `--with-hooks` flag in `bootstrap-ejs.sh` is silently ignored (no-op) rather than causing an error, so existing scripts that pass it won't break.

---

# Consequences

### Positive
- Simpler repository structure (4 fewer files)
- Simplified bootstrap scripts (removed `--with-hooks` / `-WithHooks` flags and associated logic)
- Cleaner documentation (removed 3 README sections about git hooks)
- No manual installation step for hooks
- Clearer system boundary: EJS = Copilot workflows only

### Negative / Trade-offs
- Developers who commit/push without an active Copilot session won't get journey file reminders
- CLI-only git workflows have no EJS reminders (accepted — out of scope)

---

# Key Learnings

- When a deterministic platform mechanism (Copilot hooks) supersedes an optional manual mechanism (git hooks), the manual mechanism should be removed rather than kept "just in case" — it adds maintenance burden and confuses the system's boundaries.
- The layered architecture (ADR 0016) made this decision clear: Layer 0 guarantees what git hooks only reminded about.

---

# Agent Guidance

- Do not recreate git hooks for EJS. Copilot hooks handle all structural automation.
- If a future need arises for commit/push-time checks, evaluate whether Copilot hooks can be extended first.
- The `--with-hooks` flag in `bootstrap-ejs.sh` is a silent no-op for backward compatibility. It can be removed in a future cleanup.
