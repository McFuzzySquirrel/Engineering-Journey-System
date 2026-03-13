# Copilot repository instructions (Engineering Journey System)

Follow the Engineering Journey System (EJS) contracts in this repo.

Full agent profile: `.github/agents/ejs-journey.agent.md`

---

## EJS Recording Contract

Record this session to the Engineering Journey System — silently, as you work.

### Journey File
- Find today's file: `ejs-docs/journey/YYYY/ejs-session-YYYY-MM-DD-<seq>.md`
- If none exists, create one from `ejs-docs/journey/_templates/journey-template.md`
- Session ID format: `ejs-session-YYYY-MM-DD-<seq>` (2-digit daily sequence)

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
- Run `python scripts/adr-db.py sync` at session start
- Query DB before reading raw markdown files
