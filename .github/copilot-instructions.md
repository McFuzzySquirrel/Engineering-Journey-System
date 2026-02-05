# Copilot repository instructions (Engineering Journey System)

Follow the Engineering Journey System (EJS) contracts in this repo:

- Custom agent profile: `.github/agents/ejs-journey.agent.md`
- Session wrap-up skill: `.github/skills/ejs-session-wrapup/SKILL.md`

When the user signals session end (wrap up / commit / push / ship), switch to Journey Capture Mode and:
- Always create/update exactly one Session Journey at `ejs-docs/journey/YYYY/ejs-session-YYYY-MM-DD-<seq>.md`
- Create an ADR at `ejs-docs/adr/NNNN-<kebab-title>.md` only when the decision rubric triggers

Do not claim commands/tests ran unless you observed the output.
