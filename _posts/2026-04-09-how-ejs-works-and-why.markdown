---
layout: post
title: "How I Built a System to Remember Everything My AI Agents Do (and Why)"
date: 2026-04-09 19:00:00 +0200
categories: personal engineering
tags: [EJS, AI collaboration, architecture decisions, agent workflows]
---

> *A layered system for capturing human + AI collaboration, decisions, and learning — with hooks that guarantee it works even when agents don't follow instructions.*

I built the Engineering Journey System (EJS) because decisions are where knowledge lives, not code. This post explains how it works today, why it's designed the way it is, and the decisions that shaped it over eight iterations.

<!--more-->

## The Problem I Kept Running Into

Every time I finished a multi-session project with an AI coding agent, I hit the same wall: *why did we do it that way?*

The reasoning lived in chat history. The alternatives considered were scattered across closed conversations. The experiments that changed direction, the near-misses, the rejections — gone. Even the agent's own suggestions, the ones I adopted and the ones I pushed back on — invisible.

Traditional Architecture Decision Records (ADRs) help, but they capture the *final decision*. They miss the journey: the collaboration trail, the evidence that emerged, the pivots that happened along the way.

I wanted a system that captures all of that with low friction and high auditability. Something that works silently alongside whatever agent I'm already using. Something that doesn't require me to remember to do anything at the end of a session.

That's what EJS became.


## What EJS Actually Does

At its core, EJS does two things:

1. **One Session Journey per session** — a running record of what happened, initialized at session start, updated throughout, finalized at session end
2. **ADRs only when significant** — conditional, numbered, curated — not one per session, but one per *decision that matters*

The Session Journey captures the collaboration trail: interactions, experiments, decisions made (with rationale and alternatives), sub-agent delegations, agent influence (what was adopted vs. rejected). It's updated incrementally *while the context is fresh*, not reconstructed from memory at the end.

The ADR gets created only when the session produced a significant architecture or design decision. It links back to the journey that triggered it.

Together they form a knowledge graph: every decision is traceable, every choice documented, every learning preserved.


## The Architecture: Four Layers

EJS evolved through eight ADRs (0010–0017) into a four-layer architecture. Each layer has a clear purpose and they're complementary, not competing.

### Layer 0 — Copilot Hooks (Guaranteed Structural Automation)

This is the foundation. Four shell scripts that run automatically at defined points in a Copilot coding agent session:

| Hook | What it does |
|------|-------------|
| `session-start.sh` | Syncs the EJS database, creates the journey file scaffold with metadata |
| `session-end.sh` | Validates journey completeness, flags incomplete sections |
| `subagent-stop.sh` | Logs a timestamped placeholder when a sub-agent completes |
| `log-prompt.sh` | Records every prompt to a JSONL audit trail |

These hooks run **deterministically**. They don't depend on the agent following instructions. They don't care if the agent's context window is full or if it's having a bad day. The structural foundation is always there.

**Why this matters**: Before hooks, everything depended on the agent reading instructions and choosing to comply. That worked most of the time, but "most of the time" isn't good enough for a system that's supposed to be your engineering memory.

### Layer 1 — Micro-Instructions (~30 Lines, Always-On)

A compact recording contract in `.github/copilot-instructions.md` that tells whatever agent is active: *record silently as you work*. Log interactions, decisions, sub-agent work, and agent influence to the Session Journey.

This started as 112 lines (~940 words). Through deliberate simplification (ADR 0015), it was reduced to ~30 lines (~200 words) — a 79% reduction. The key insight: **instructions should define behavior, not format**. Templates and skills carry the structural detail.

### Layer 2 — Agent Skills (On-Demand Semantic Enrichment)

Three skills that Copilot auto-loads when relevant:

- **`ejs-session-init`** — Enhances the hook-created scaffold with problem/intent and agents involved
- **`ejs-session-wrapup`** — Finalizes all sections, populates machine extracts, evaluates the ADR decision rubric
- **`ejs-sub-agent-capture`** — Enriches hook placeholders with decisions, rationale, and handoff context

Skills handle the *semantic* tasks that require LLM reasoning. Hooks handle the *structural* tasks that should happen identically every time. Together, they eliminate the reliability gap.

### Layer 3 — Custom Agent (Observer + Coordinator)

The `ejs-journey` agent profile for when you want explicit control:

- **Tier 2** (bookend): Invoke `@ejs-journey` at session start/end, work with your normal agents in between
- **Tier 3** (coordinator): Select `ejs-journey` from the agent dropdown and it coordinates the full session, delegating implementation to sub-agents


## The Decisions That Shaped It

What I find most valuable about building EJS *with* EJS is that every significant decision is documented in its own ADR. Here's the narrative:

### ADR 0010: Just Start Recording

The first decision was the simplest: adopt the system. One Session Journey per session, ADRs only for significant decisions, repo-portable structure. This set the foundation.

### ADR 0011: Capture While It's Fresh

Originally I tried end-of-session reconstruction. It was thin, missed pivots, and lost near-turning points. Switching to start-of-session initialization with continuous updates changed everything. Context captured when fresh is richer, more accurate, and more useful.

### ADR 0012: Sub-Agent Decisions Matter Too

When using multi-agent workflows, sub-agents make decisions that are often invisible. This ADR established a protocol for capturing sub-agent contributions: what they decided, why, what alternatives they considered, and how their output fed into the next agent's input.

### ADR 0013: Agents Need a Database, Not a File System

Reading every markdown file into context is expensive. A SQLite-backed index (`adr-db.py`) lets agents query past decisions efficiently. The `story` command returns a rich narrative per journey: intent, key decision, key learning, and ADR status — all in one view.

### ADR 0014: Skills > Monolithic Instructions

Rather than putting everything in the always-on instructions, factored lifecycle workflows into skills that auto-load only when relevant. The always-on instructions stay lean. Skills carry the detail.

### ADR 0015: 112 Lines → 30 Lines

Quantified the redundancy across EJS files (same content repeated in 3–4 places) and simplified the always-on instructions to a micro-instruction model. Instructions define *behavior*. Templates define *format*. Skills define *workflow*.

This also surfaced a blind spot: sub-agents received zero EJS context. A tiny ~40-word delegation fragment closed the gap without architectural changes.

### ADR 0016: Hooks as Layer 0

The most significant architectural decision. Research found that Copilot hooks can guarantee structural tasks (file creation, DB sync, validation) regardless of agent compliance. But they can't do semantic tasks (writing rationale, evaluating ADR rubrics). The insight: **hooks and agents are complementary, not competitive**. Hooks provide the skeleton. Agents provide the substance.

### ADR 0017: Remove the Redundant Layer

With Copilot hooks guaranteeing that journey files exist and completeness is validated, the old git hooks (commit/push-time reminders) became redundant. Rather than keeping them "just in case," they were removed. When a deterministic platform mechanism supersedes an optional manual one, the manual one should go.


## How It Works in Practice

Here's what a typical session looks like:

**1. I start a session.** Copilot hooks automatically:
   - Sync the database (`adr-db.py sync`)
   - Create a journey scaffold from the template
   - The `ejs-session-init` skill enhances it with my problem/intent

**2. I work normally.** My coding agent does its thing. As it works, it silently:
   - Logs each interaction to the journey
   - Records decisions with rationale
   - Captures sub-agent delegations and outcomes
   - Tracks what agent suggestions I adopt vs. reject

**3. I wrap up.** The agent finalizes the journey:
   - Completes all sections with coherent summaries
   - Populates machine-readable extracts
   - Evaluates whether an ADR should be created
   - Copilot hooks validate completeness

**4. I review and commit.** The Session Journey and any ADR are part of the PR.

The critical thing: **I don't have to remember to do any of this.** Layer 0 guarantees the structure. Layer 1 tells the agent to record. Layers 2–3 enrich the content. If any layer fails, the others still provide value.


## The Non-Competing Observer Model

One design principle that shaped everything: **EJS is additive, not competitive.**

It does not replace your existing agents or instructions. It injects silent recording behavior alongside them. Whatever agent you're already using, EJS observes and records without interfering.

This means:
- No agent switching required for basic recording (Tier 1)
- Works with any AI tool that supports custom instructions (Copilot, Claude Code, Cursor, aider)
- Recording happens as a side-effect of normal work
- Your implementation agent stays focused on implementation

I use this across all my projects now. [eZansiEdgeAI Small](https://github.com/McFuzzySquirrel/ezansiedgeai-small) has its own EJS artifacts. The [3D Asteroids game](https://github.com/McFuzzySquirrel/Engineering-Journey-System/tree/main/game) in the EJS repo was built entirely through multi-agent workflows with full EJS recording.


## Adopting EJS in Your Own Repos

If you want to try this, there's a bootstrap script:

```bash
# From a local clone of the EJS starter repo:
./scripts/bootstrap-ejs.sh /path/to/your-repo

# Preview what would change:
./scripts/bootstrap-ejs.sh --dry-run /path/to/your-repo
```

It copies the hooks, agent profile, skills, templates, and database tool. It **appends** the recording contract to your existing `copilot-instructions.md` (doesn't replace it). It's idempotent — safe to run multiple times.

The result is the full four-layer stack in your repo, activated automatically the moment you merge to the default branch.


## What I've Learned

### Deterministic ≠ Semantic

Hooks excel at things that should happen identically every time. Agents excel at things that require understanding. The cleanest architecture assigns each concern to the right mechanism.

### Incremental Capture Beats Reconstruction

I tested both. Reconstructed notes are thin, lose pivots, and miss near-turning points. Capturing at decision-time is richer, more accurate, and more useful. Every time.

### Rejection Is as Valuable as Adoption

The Agent Influence section records both what was adopted *and* what was rejected, with rationale. This has become some of the highest-value data in the system. Future sessions don't re-propose rejected approaches without context.

### Redundancy Is Measurable

The simplification from 112 lines to 30 was only justified because I measured the redundancy first (same content in 3–4 places). Without that evidence, the change would have felt arbitrary.

### When Platform Supersedes Manual, Remove the Manual

Keeping the old git hooks alongside Copilot hooks would have added maintenance burden and confused the system's boundaries. When a guaranteed mechanism replaces an optional one, let the optional one go.


## The Pattern That Matters

This isn't really about any specific tool. It's about making the implicit explicit.

Every time an agent makes a suggestion, every time I reject an approach, every time a sub-agent makes a decision — that's knowledge. EJS externalizes it. Makes it visible, reviewable, persistent, and searchable.

The tools will evolve. The pattern won't: **capture context while it's fresh, document decisions with rationale, connect the dots, and make knowledge compound instead of reset.**


## Resources

- [Engineering Journey System (EJS)](https://github.com/McFuzzySquirrel/Engineering-Journey-System) — starter repo with full architecture
- [Session Lifecycle Patterns](https://github.com/McFuzzySquirrel/Engineering-Journey-System/blob/main/ejs-docs/session-lifecycle-patterns.md) — flow diagrams and data flows
- [ADRs 0010–0017](https://github.com/McFuzzySquirrel/Engineering-Journey-System/tree/main/ejs-docs/adr) — the complete decision history

All of my projects exist for one core reason: learning through experimentation. Feel free to reuse, modify, and build on anything here in your own repositories.
