# Knowledge Graph Schema

The EJS knowledge graph is a JSON file (`ejs-docs/knowledge-graph/index.json`)
that cross-references all living documents in the repository for fast,
structured retrieval by agents.

---

## Purpose

The knowledge graph allows an agent to ask *"what do I need to know before
starting work on X?"* and receive a ranked, structured answer without
reading every ADR and journey file from scratch.

It is rebuilt by `scripts/knowledge-graph.py sync` at the start of each
session and whenever living documents are updated.

---

## Schema

```json
{
  "schema_version": "1.0",
  "last_updated": "<ISO-8601 timestamp>",
  "nodes": [ <Node>, ... ],
  "edges": [ <Edge>, ... ]
}
```

### Node

```json
{
  "id":       "<unique string>",
  "type":     "adr | architecture | readme | session",
  "title":    "<human-readable title>",
  "path":     "<path relative to repo root>",
  "date":     "YYYY-MM-DD",
  "tags":     ["<tag>", ...],
  "summary":  "<one or two sentence summary>",
  "related":  ["<node-id>", ...]
}
```

| Field | Required | Notes |
|---|---|---|
| `id` | ✅ | Stable identifier. For ADRs: `adr-NNNN`. For sessions: the session_id. For others: slugified path. |
| `type` | ✅ | One of `adr`, `architecture`, `readme`, `session` |
| `title` | ✅ | Human-readable name |
| `path` | ✅ | Relative to repository root |
| `date` | ✅ | ISO date (YYYY-MM-DD) of last meaningful update |
| `tags` | — | Keywords for search ranking |
| `summary` | — | Short description for agent context injection |
| `related` | — | IDs of directly related nodes (populated from frontmatter and content references) |

### Edge

```json
{
  "from": "<node-id>",
  "to":   "<node-id>",
  "rel":  "implements | references | supersedes | triggers | updates"
}
```

| `rel` value | Meaning |
|---|---|
| `implements` | A session or ADR implements a decision in another node |
| `references` | A document explicitly references another |
| `supersedes` | An ADR supersedes an older ADR |
| `triggers` | A session triggered the creation of this ADR or blueprint update |
| `updates` | A session updated the architecture blueprint or README |

---

## How Relationships Are Inferred

1. **ADR → session**: ADR frontmatter `ejs.session_id` links to the originating session
2. **session → ADR**: Journey frontmatter `adr_links` lists linked ADR IDs
3. **Architecture Blueprint → ADR**: Blueprint `## Tech Decisions` table references ADR IDs
4. **README → Architecture Blueprint**: README contains a link to the blueprint path
5. **session → Architecture Blueprint**: Session wrapup skill writes a `## Recent Changes` entry

---

## Querying

```bash
# Rebuild the index
python scripts/knowledge-graph.py sync

# Full-text search
python scripts/knowledge-graph.py search "sqlite decision"

# Get a specific node by id
python scripts/knowledge-graph.py get adr-0013

# List all nodes of a type
python scripts/knowledge-graph.py list --type adr
python scripts/knowledge-graph.py list --type session
```

---

## File Location

```
ejs-docs/knowledge-graph/index.json   ← committed to the repository
```

Unlike `.ejs.db`, the knowledge graph index **is committed** so that it is
available immediately when a new developer clones the repository, before
running any sync commands.
