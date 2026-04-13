---
ejs:
  type: journey-adr
  version: 1.1
  adr_id: "0019"
  title: Phase 2 Copilot Hook Audit and Telemetry Expansion
  date: 2026-04-13
  status: accepted
  session_id: ejs-session-2026-04-13-01
  session_journey: ejs-docs/journey/2026/ejs-session-2026-04-13-01.md

actors:
  humans:
    - id: McFuzzySquirrel
      role: system owner
  agents:
    - id: GitHub Copilot (GPT-5.3-Codex)
      role: implementation agent

context:
  repo: Engineering-Journey-System
  branch: feat/hooks-phase2
---

# Session Journey

Link to the originating session artifact:
- Session Journey: `ejs-docs/journey/2026/ejs-session-2026-04-13-01.md`
- Prior foundation ADR: `ejs-docs/adr/0016-copilot-hooks-layer-0-structural-automation.md`

# Context

ADR 0016 established Layer 0 Copilot hooks with an Option B baseline (sessionStart, sessionEnd, subagentStop, userPromptSubmitted) and deferred Option C hooks due to blocking/performance risk.

This session implemented and validated the deferred optional hooks in a feature branch:
- preToolUse
- postToolUse
- agentStop
- errorOccurred

The central concern was whether expanding hook coverage would improve EJS value without harming developer flow or introducing brittle enforcement.

---

# Session Intent

Implement a safe Phase 2 expansion that increases EJS observability and auditability while preserving the non-blocking design principle introduced in ADR 0016.



# Collaboration Summary

Human and agent first validated hook-name support against platform constraints, then selected the "full valid set" for implementation on a dedicated branch. The implementation added new hook scripts, extended the manifest, updated bootstrap scripts, and updated documentation.

The key collaboration pivot was from "include all listed names" to "include only platform-valid names". Unsupported names (`postToolUseFailure`, `subagentStart`, `notification`) were explicitly excluded. The human then requested clarification of value, and README documentation was expanded to explain practical benefits and guardrails.

---

# Decision Trigger / Significance

This change warrants an ADR because it meets multiple rubric criteria:

- Changes engineering workflow for future work (new always-on telemetry surfaces)
- Introduces long-lived operational consequences (new audit streams and hook behavior)
- Represents a choice among credible alternatives (retain Option B only vs selective Phase 2 adoption vs full enforcement)
- Modifies EJS structural contract for Copilot hook coverage

# Considered Options

## Option A: Keep Option B only
Retain ADR 0016 baseline hooks and do not add any Phase 2 events.

## Option B: Partial Phase 2
Add only low-risk optional hooks (`agentStop`, `errorOccurred`).

## Option C: Full valid Phase 2 set (chosen)
Add all platform-valid deferred hooks (`preToolUse`, `postToolUse`, `agentStop`, `errorOccurred`) with soft, non-blocking behavior.

---

# Decision

Adopt Option C on feature branch `feat/hooks-phase2`: implement full valid Phase 2 hook coverage with strict non-blocking behavior.

Concretely:
- `preToolUse` always returns allow (soft enforcement only)
- all new hooks append JSONL audit records
- hook scripts remain lightweight and fail-open (exit 0)

---

# Rationale

Option C provides the highest observability gain while preserving user flow, because enforcement remains soft and latency impact is minimized.

Compared with Option A, it adds useful operational evidence for debugging and timeline reconstruction. Compared with Option B, it avoids fragmenting rollout and enables end-to-end tool lifecycle visibility immediately.

The risk identified in ADR 0016 (blocking loops/confusing denials) is explicitly controlled by always-allow semantics in `preToolUse` during this phase.

---

# Consequences

### Positive
- Improved tool-level observability through pre/post tool audit records
- Better runtime diagnostics via errorOccurred logging
- Clearer session chronology with agentStop boundaries
- Higher trust in journey narratives via operational corroboration
- Foundation for future analytics on tool success/failure patterns

### Negative / Trade-offs
- Increased maintenance surface area (additional scripts and docs)
- Additional JSONL log volume to manage
- Future temptation to tighten enforcement prematurely (must remain controlled)

---

# Key Learnings

- Full valid hook coverage can be introduced safely when preToolUse remains soft and scripts are fail-open.
- Telemetry hooks add significant value even without hard policy enforcement.
- Explicit documentation of guardrails is essential to prevent future regressions into blocking behavior.

---

# Agent Guidance

Instructions and signals for future agents:
- Treat `preToolUse` as soft enforcement unless a separately approved policy ADR authorizes deny logic.
- Keep hook scripts fast, deterministic, and non-blocking.
- Preserve schema-defensive JSON parsing because hook payloads can evolve.
- When expanding hook behavior, update both implementation and adoption docs in the same change set.

---

# Reuse Signals (Optional)

```yaml
reuse:
  patterns:
    - "expand hook coverage with fail-open behavior first, enforcement later"
    - "pair telemetry additions with clear README and lifecycle documentation"
  prompts:
    - "is this hook policy safe under failure and timeout conditions?"
    - "does this change improve observability without blocking delivery flow?"
  anti_patterns:
    - "introducing deny logic in preToolUse without explicit policy and tests"
    - "adding hook events not supported by platform"
  future_considerations:
    - "evaluate sampled tool analytics from logs/ejs-tool-use-audit.jsonl"
    - "consider opt-in strict mode only after sustained stability evidence"
```
