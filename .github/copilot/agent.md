# GitHub Copilot Agent Configuration

This file configures the GitHub Copilot agent for this repository.

## Agent Behavior

The agent should:
- Follow the established folder structure
- Use templates when creating new journeys or ADRs
- Maintain consistency in documentation
- Reference agent memory patterns when applicable

## Documentation Standards

### Journey Entries
- Use the template from `docs/journey/_templates/journey-template.md`
- Organize by year/month: `docs/journey/YYYY/MM/`
- Name files: `YYYY-MM-DD-description.md`

### Architecture Decision Records
- Follow the ADR template: `docs/adr/0000-adr-template.md`
- Number sequentially: `0001`, `0002`, etc.
- Use descriptive titles

### Agent Memory
- Update patterns as you learn
- Document successful approaches in `prompt-patterns.md`
- Document architectural insights in `architecture-patterns.md`
- Document pitfalls in `anti-patterns.md`

## Code Standards

- Write clear, maintainable code
- Follow existing patterns in the repository
- Document architectural decisions
- Test thoroughly before committing

## Communication

- Be clear and concise
- Provide context for decisions
- Ask for clarification when needed
- Document learnings for future reference
