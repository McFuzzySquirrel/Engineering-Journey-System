# Skill: Solution Journey + ADR Capture

## Triggers

- User comment: "Create Journey Record"
- PR events: opened, synchronize, ready_for_review
- Post-merge to main (index & lint pass)

## Steps

1) Collect context:
   - Git diff (primary)
   - PR title/body & linked issues
   - Changed files summary and test coverage deltas if available
   - Past ADRs & journeys for cross-linking
2) Draft Journey (use template below)
3) Detect decisions → draft ADR
4) Update Agent Memory extracts
5) Update ADR index
6) Run lint (structure + links) and fix if trivial
7) Output summary as PR comment

## Journey Template (strict)

journey_id: auto author: ${author} date: ${yyyy-mm-dd} repo: ${repo} branch: ${branch} agents_involved:
 - github_copilot decision_detected: ${true|false} adr_links: [] tags: [architecture, agent-collaboration]
Problem / Intent
Agent Collaboration Summary
Key Learnings
Decisions Made
If Repeating This Work
Experiments / Alternatives Tried
Future Agent Guidance

MACHINE EXTRACTS
- DECISIONS_EXTRACT
- LEARNING_EXTRACT
- AGENT_GUIDANCE_EXTRACT

## ADR Template (strict)

ADR NNNN -
Status
 - Accepted
Context
Decision
Alternatives Considered
- Option A:
- Option B:

Consequences
Positive: Negative: Tradeoffs:

Links
Journey Source: Related ADRs:


            - Memory updates: ${{ steps.gen.outputs.memory_updates }}
