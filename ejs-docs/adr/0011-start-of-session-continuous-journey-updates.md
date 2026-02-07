---
ejs:
  type: journey-adr
  version: 1.0
  adr_id: 0011
  title: Shift EJS to Start-of-Session with Continuous Journey Updates
  date: 2026-02-07
  status: accepted
  session_id: ejs-session-2026-02-07-001

actors:
  humans:
    - id: mcfuzzysquirrel
      role: lead-engineer
  agents:
    - id: github-copilot
      role: coding-agent

context:
  repo: Engineering-Journey-System
  branch: copilot/add-ejs-session-initialization
  platform: github
  tools:
    - github-copilot
    - vscode
---

# Context

EJS was initially designed with an end-of-session approach: agents would reconstruct the entire Session Journey at the conclusion of work, relying on memory and chat history.

User feedback from a multi-step, multi-agent session in another repository (photo-jumper) revealed that **starting EJS at session beginning** and **updating continuously throughout** produced significantly better documentation quality.

The key insight: incremental real-time capture preserves context better than end-of-session reconstruction.

---

# Session Intent

Determine whether EJS should shift from end-of-session reconstruction to start-of-session initialization with continuous updates throughout the session lifecycle.

Related session journey: [ejs-docs/journey/2026/ejs-session-2026-02-07-001.md](../journey/2026/ejs-session-2026-02-07-001.md)

---

# Collaboration Summary

Human observed that continuous journey updates during a multi-step session produced far better documentation than end-of-session reconstruction.

Agent confirmed this aligns with best practices for documentation: capture context when fresh, not from memory.

Human requested implementation of start-of-session initialization with continuous updates.

Agent implemented the three-phase lifecycle (initialization, continuous updates, finalization) across all EJS artifacts.

---

# Considered Options

## Option A – Keep End-of-Session Reconstruction (Status Quo)
Continue requiring agents to reconstruct the entire Session Journey at session end from memory and chat history.

**Pros:**
- No changes required
- Familiar pattern for existing users
- Single point of documentation effort

**Cons:**
- Relies on imperfect memory
- Details lost or become fuzzy over time
- High cognitive burden concentrated at session end
- Temptation to skip or rush documentation
- Poor quality for multi-step or multi-agent sessions
- No incremental benefit during session

## Option B – Optional Continuous Updates
Allow agents to optionally update the journey during the session, but don't require it.

**Pros:**
- Flexibility for different working styles
- Gradual adoption path

**Cons:**
- Inconsistent documentation quality
- Agents may default to old end-of-session pattern
- Unclear guidance leads to confusion
- Benefits not realized if agents don't adopt

## Option C – Start-of-Session with Continuous Updates (Chosen)
Shift to a three-phase lifecycle:
1. **Session Initialization** - Create journey at session start
2. **Continuous Updates** - Update journey throughout session
3. **Journey Finalization** - Complete and finalize at session end

**Pros:**
- Context captured when fresh (higher accuracy)
- Distributed effort throughout session (lower burden)
- Better multi-step/multi-agent session support
- Incremental value during session
- Reduced end-of-session cognitive load
- Aligns with documentation best practices
- Real-world validation from user experience

**Cons:**
- Requires habit change for existing users
- Slightly more frequent file updates
- Agents need to learn when to update

---

# Decision

Adopt **Option C: Start-of-Session with Continuous Updates**

EJS will shift to a three-phase session lifecycle:

### Phase 1: Session Initialization (Start)
- Create Session Journey immediately when work begins
- Populate initial metadata and problem/intent
- Establish structure for continuous updates

### Phase 2: Continuous Updates (During)
- Update Interaction Summary as exchanges occur
- Record experiments and outcomes in real-time
- Document decisions immediately with rationale
- Capture pivots and iterations when they happen
- Record learnings as they emerge

### Phase 3: Journey Finalization (End)
- Complete all sections with coherent summaries
- Populate machine extracts
- Apply ADR decision rubric
- Create ADR only if criteria met

---

# Rationale

**Option A** failed to produce high-quality documentation in practice. Real-world usage showed:
- Important details lost to time
- Collaboration trail reconstructed imperfectly from memory
- High burden at session end led to rushed or skipped documentation

**Option B** provided inconsistent results and lacked clear guidance. Optional patterns tend not to be adopted consistently.

**Option C** addresses all identified problems:
- Fresh context → accurate documentation
- Distributed effort → sustainable practice
- Real-time capture → no reconstruction burden
- Validated by actual user experience in photo-jumper repository

---

# Consequences

### Positive
- **Higher documentation quality** - Context captured when fresh, not reconstructed
- **Lower end-of-session burden** - Most work done throughout session
- **Better collaboration trails** - Accurate record of prompts/responses/outcomes
- **Improved multi-step session support** - Full history preserved incrementally
- **Sustainable practice** - Distributed effort vs. concentrated burden

### Negative / Trade-offs
- **Habit change required** - Existing users must adapt to new workflow
- **More frequent updates** - Agents update journey multiple times per session
- **Learning curve** - Agents need guidance on when/what to update

### Mitigation
- Clear documentation in `ejs-docs/agent-memory/session-lifecycle-patterns.md`
- Updated agent instructions in `.github/agents/ejs-journey.agent.md`
- Updated skill instructions in `.github/skills/ejs-session-wrapup/SKILL.md`
- Updated README with workflow guidance
- Examples and anti-patterns documented

---

# Implementation Changes

Files updated:
- `.github/agents/ejs-journey.agent.md` - Three-phase operating mode
- `.github/skills/ejs-session-wrapup/SKILL.md` - Session lifecycle management
- `.github/copilot-instructions.md` - Lifecycle workflow
- `README.md` - User-facing documentation
- `ejs-docs/agent-memory/session-lifecycle-patterns.md` - NEW: Detailed patterns guide

---

# Key Learnings

**Technical insights:**
- Real-time capture is superior to reconstruction for preserving context
- Distributed documentation effort is more sustainable than concentrated end-of-session work
- Session boundaries benefit from explicit initialization, not just finalization

**Prompting insights:**
- Users naturally signal session start ("let's start", "begin working on")
- Continuous updates should be implicit (automatic) not explicit (prompted every time)
- Clear lifecycle phases help agents know when to take what actions

**Tooling insights:**
- Three-phase lifecycle maps naturally to agent operating modes
- Incremental file updates don't create git noise (same file, continuous story)
- Machine extracts can still be populated at finalization despite continuous updates

---

# Agent Guidance

**Prefer:**
- Initializing Session Journey at first sign of new work
- Updating journey incrementally after meaningful progress
- Keeping updates atomic and focused
- Appending to sections (not rewriting entire journey)
- Finalizing quickly at session end (mostly done already)

**Avoid:**
- Waiting until session end to create journey
- Relying on memory to reconstruct collaboration trail
- Overwriting entire journey file on each update
- Skipping mid-session updates ("I'll document later")
- Creating ADRs that don't meet the rubric

**Watch out for:**
- Session boundaries - initialize explicitly at start
- Decision moments - capture immediately with rationale
- Pivots/iterations - document why the approach changed
- Experiments - record what happened, not just final outcome

---

# Reuse Signals

```yaml
reuse:
  patterns:
    - three-phase-session-lifecycle
    - continuous-documentation-updates
    - session-initialization
  prompts:
    - "Initialize session for [task]"
    - "Update session journey with recent progress"
    - "Finalize journey"
  anti_patterns:
    - end-of-session-reconstruction
    - optional-continuous-updates
  future_considerations:
    - automated journey update triggers
    - IDE integration for session lifecycle
    - journey diff/review tools
```

---

# Evidence from Real-World Usage

The user's example from photo-jumper repository showed:
- **17 human-agent interactions** captured accurately in chronological order
- **4 major decisions** documented with full rationale
- **16 iterations** tracked with reasons for pivots
- **Multiple experiments** recorded with outcomes
- **ADR created mid-session** when decision criteria met

This level of detail and accuracy would be nearly impossible to reconstruct from memory at session end.

The continuous-update approach proved its value in practice.
