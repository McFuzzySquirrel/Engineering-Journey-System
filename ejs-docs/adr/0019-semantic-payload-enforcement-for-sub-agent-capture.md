---
ejs:
  type: journey-adr
  version: 1.1
  adr_id: "0019"
  title: Semantic Payload Enforcement for Sub-Agent Capture
  date: 2026-05-14
  status: accepted
  session_id: ejs-session-2026-05-14-01
  session_journey: ejs-docs/journey/2026/ejs-session-2026-05-14-01.md

actors:
  humans:
    - id: McFuzzySquirrel
      role: system owner
  agents:
    - id: GitHub Copilot (copilot-coding-agent)
      role: implementation and documentation agent

context:
  repo: Engineering-Journey-System
  branch: chore/optimize
---

# Session Journey

Link to the originating session artifact:
- Session Journey: `ejs-docs/journey/2026/ejs-session-2026-05-14-01.md`

# Context

EJS hook automation guarantees structural capture (session start/end and sub-agent stop events), but sub-agent records can still be semantically incomplete. In practice, many entries contain `unknown` agent names, empty task fields, and placeholder decision blocks, which weakens traceability and increases downstream reconstruction cost.

The system needed a reversible enforcement approach that improves semantic quality without breaking existing workflows.

---

# Session Intent

Introduce semantic payload enforcement for sub-agent capture with a staged rollout that preserves reliability and allows rollback.

# Collaboration Summary

The implementation added enforcement-aware behavior to hook scripts, updated skill/instruction contracts for payload requirements, documented runtime modes in README, and formalized the decision in this ADR. The chosen approach prioritized observability first (soft mode) before strict gating.

---

# Decision Trigger / Significance

This change modifies the collaboration protocol between hooks, agents, and journey artifacts. It affects session completeness outcomes and introduces a new quality gate for sub-agent records, making it a durable process decision that should be tracked as an ADR.

# Considered Options

## Option A
Keep current placeholder-tolerant behavior with no semantic enforcement.

## Option B
Enable soft enforcement only (warnings/markers), never strict gating.

## Option C
Use staged enforcement: `off` -> `soft` -> `strict` behind feature flags and quality gates.

---

# Decision

Adopt Option C.

EJS will support semantic enforcement modes through hook runtime flags:
- `off` (default compatibility)
- `soft` (mark unresolved and surface violations)
- `strict` (require compliant semantic payloads for resolved capture)

Session-end validation will include unresolved semantic checks when enforcement is enabled.

---

# Rationale

- Structural capture alone is insufficient for high-value journey records.
- Soft mode creates visibility and adoption runway with minimal disruption.
- Strict mode provides strong fidelity guarantees once metrics stabilize.
- Feature-flagged rollout keeps the change reversible and safe for existing workflows.

---

# Consequences

### Positive
- Higher sub-agent traceability and decision quality in journey artifacts.
- Better audit fidelity for enforcement status and violations.
- Reduced manual reconstruction and downstream token overhead.

### Negative / Trade-offs
- Temporary increase in INCOMPLETE sessions during soft-mode adoption.
- Minor hook runtime overhead for validation logic.
- Strict mode can block resolved status for non-compliant payloads.

---

# Key Learnings

- Reliability requires both structural and semantic guarantees.
- Feature flags are essential for safe process-level changes in agent workflows.
- Validation without observability is fragile; audit enrichment must ship with enforcement.

---

# Agent Guidance

- Prefer `soft` mode first to baseline violations and unknown-field rates.
- Promote to `strict` only after two stable measurement windows.
- Avoid placeholder tokens (`unknown`, `_To be filled by parent agent_`) in sub-agent payloads.
- Keep always-on instructions minimal; place detailed payload format in skills.

---

# Reuse Signals (Optional)

```yaml
reuse:
  patterns:
    - "mode-gated enforcement rollout (off/soft/strict)"
    - "session-end semantic completeness checks"
    - "audit-first observability before strict gating"
  prompts:
    - "start with soft enforcement and collect violation ratios"
    - "block strict promotion unless quality gates are stable"
  anti_patterns:
    - "enabling strict mode before telemetry is trustworthy"
    - "treating placeholder entries as acceptable completion data"
  future_considerations:
    - "add dedicated hook-level tests for semantic validator edge cases"
    - "ingest enforcement metrics into the DB for trend reporting"
```
