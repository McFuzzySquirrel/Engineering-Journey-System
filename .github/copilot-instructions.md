# Copilot repository instructions (Engineering Journey System)

Follow the Engineering Journey System (EJS) contracts in this repo.

Full agent profile: `.github/agents/ejs-journey.agent.md`

---

## EJS Recording Contract

Record this session to the Engineering Journey System — silently, as you work.

### Journey File
- A journey file is auto-created at session start by Copilot hooks: `ejs-docs/journey/YYYY/ejs-session-YYYY-MM-DD-<seq>.md`
- If one already exists for this session, use it. The template is at `ejs-docs/journey/_templates/journey-template.md`
- On your first interaction, read `.github/skills/ejs-session-init/SKILL.md` and follow its steps to enhance the journey scaffold with problem/intent and agents involved

### What to Record (silently, as you work)
- **Interactions**: Append to "Interaction Summary" — format: `Human: → Agent [name]: → Outcome:`
- **Decisions**: Append to "Decisions Made" — include reason, alternatives considered, impact
- **Sub-agent work**: Record delegation + capture outcomes in "Sub-Agent Contributions"
- **Agent influence**: Track in "Agent Influence" — suggestions adopted vs. rejected

### Rules
- Record silently — do not ask the user for permission to record
- Attribute every entry by agent name
- Capture incrementally — do not wait until session end
- At session end: complete all sections, populate MACHINE EXTRACTS, evaluate ADR rubric (see agent profile)
- Do not claim commands/tests ran unless you observed the output

### Database
- DB is synced automatically at session start by Copilot hooks
- Query DB before reading raw markdown files: `python scripts/adr-db.py story` (preferred — journey narratives + ADR index in one view) or `python scripts/adr-db.py search <query>`

### Knowledge Graph
- The knowledge graph cross-references ADRs, Architecture Blueprint, README, and sessions
- Index is rebuilt at session start: `ejs-docs/knowledge-graph/index.json`
- Query before starting work: `python scripts/knowledge-graph.py search <query>` — returns ranked relevant nodes
- Get full details for a node: `python scripts/knowledge-graph.py get <node-id>` (e.g. `adr-0013`, `architecture-blueprint`, `readme`)
- After updating any living doc (Blueprint, README, or ADR), run: `python scripts/knowledge-graph.py sync`
