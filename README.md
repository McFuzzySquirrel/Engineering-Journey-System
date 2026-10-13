# decision-graph (`dg`)

decision-graph is a planned Node.js/TypeScript CLI for indexing architecture
decision records (ADRs) and session decision records (SDRs) into a knowledge
graph that agents can query.

Markdown records will remain the source of truth. A rebuildable SQLite index
will support scoped rule lookup, full-text search, and relationships between
decisions. Planned agent access includes the CLI, MCP, and a managed `AGENTS.md`
block. An optional server will support multi-project storage and retrieval.

## Implementation status

Phase 0 is complete: the Engineering Journey System has been retired to
[`legacy/`](legacy/README.md). The `dg` CLI is not implemented or published yet.

The detailed scope, phase checklists, and acceptance criteria are in the
[implementation plan](docs/IMPLEMENTATION-PLAN.md). Phase 1 is the package scaffold.

## Historical EJS system

The preserved archive is reference material, not an active session-recording
system. The original repository state is available at the
[`ejs-final` tag](https://github.com/McFuzzySquirrel/Engineering-Journey-System/tree/ejs-final).
