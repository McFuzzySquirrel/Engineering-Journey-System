#!/usr/bin/env python3
"""
EJS ADR Database — SQLite-backed index for Architecture Decision Records.

Parses ADR markdown files from ejs-docs/adr/, extracts YAML frontmatter and
key content sections, and stores them in a local SQLite database for fast
agent-friendly querying when full-file context would be too expensive.

Usage:
    python scripts/adr-db.py sync              # Parse ADR files → database
    python scripts/adr-db.py list              # List all ADRs (compact)
    python scripts/adr-db.py get <adr_id>      # Full details for one ADR
    python scripts/adr-db.py search <query>    # Full-text search across ADRs
    python scripts/adr-db.py summary           # Agent-friendly compact summary

The database is stored at <repo_root>/.ejs-adr.db (gitignored).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore[assignment]


# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------

def _repo_root() -> Path:
    """Return the repository root (parent of scripts/)."""
    return Path(__file__).resolve().parent.parent


def _default_db_path() -> Path:
    return _repo_root() / ".ejs-adr.db"


def _default_adr_dir() -> Path:
    return _repo_root() / "ejs-docs" / "adr"


# ---------------------------------------------------------------------------
# Markdown / YAML parsing
# ---------------------------------------------------------------------------

_FRONTMATTER_RE = re.compile(r"\A---\n(.*?\n)---\n", re.DOTALL)
_ADR_ID_RE = re.compile(r"^\s*adr_id:\s*(\S+)", re.MULTILINE)


def _parse_frontmatter(text: str) -> dict[str, Any]:
    """Extract YAML frontmatter from a markdown string."""
    m = _FRONTMATTER_RE.match(text)
    if not m:
        return {}
    raw = m.group(1)
    if yaml is not None:
        return yaml.safe_load(raw) or {}
    # Minimal fallback when PyYAML is absent — only extracts flat top-level
    # key: value pairs.  Nested structures (ejs, actors, context) will not
    # be parsed correctly, so adr-db features that depend on them will
    # degrade.  Install PyYAML for full functionality.
    result: dict[str, Any] = {}
    for line in raw.splitlines():
        if ":" in line and not line.startswith(" "):
            key, _, value = line.partition(":")
            result[key.strip()] = value.strip()
    return result


def _extract_section(text: str, heading: str) -> str:
    """Extract content under a markdown ## or # heading, up to the next heading of same or higher level."""
    # Match heading at level 1 or 2
    pattern = re.compile(
        rf"^(#{{1,2}})\s+{re.escape(heading)}\s*\n(.*?)(?=\n#{{1,2}}\s|\Z)",
        re.MULTILINE | re.DOTALL,
    )
    m = pattern.search(text)
    return m.group(2).strip() if m else ""


def parse_adr_file(filepath: Path) -> dict[str, Any] | None:
    """Parse a single ADR markdown file into a dict of metadata + sections."""
    text = filepath.read_text(encoding="utf-8")

    fm = _parse_frontmatter(text)
    if not fm:
        return None

    ejs = fm.get("ejs", {})
    if not isinstance(ejs, dict):
        return None

    # Extract adr_id from raw frontmatter text to avoid YAML octal
    # interpretation (e.g. 0042 parsed as decimal 34).
    fm_match = _FRONTMATTER_RE.match(text)
    raw_fm = fm_match.group(1) if fm_match else ""
    id_match = _ADR_ID_RE.search(raw_fm)
    adr_id = id_match.group(1) if id_match else ""
    if not adr_id or adr_id == "XXXX":
        return None  # Skip template

    actors = fm.get("actors", {}) or {}
    ctx = fm.get("context", {}) or {}

    return {
        "adr_id": adr_id,
        "title": ejs.get("title", ""),
        "date": str(ejs.get("date", "")),
        "status": ejs.get("status", ""),
        "session_id": ejs.get("session_id", ""),
        "session_journey": ejs.get("session_journey", ""),
        "actors_humans": json.dumps(actors.get("humans", [])),
        "actors_agents": json.dumps(actors.get("agents", [])),
        "context_repo": ctx.get("repo", ""),
        "context_branch": ctx.get("branch", ""),
        "decision": _extract_section(text, "Decision"),
        "context_section": _extract_section(text, "Context"),
        "rationale": _extract_section(text, "Rationale"),
        "consequences": _extract_section(text, "Consequences"),
        "key_learnings": _extract_section(text, "Key Learnings"),
        "agent_guidance": _extract_section(text, "Agent Guidance"),
        "file_path": str(filepath.relative_to(_repo_root())),
    }


# ---------------------------------------------------------------------------
# Database layer
# ---------------------------------------------------------------------------

_SCHEMA = """
CREATE TABLE IF NOT EXISTS adrs (
    adr_id          TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    date            TEXT,
    status          TEXT,
    session_id      TEXT,
    session_journey TEXT,
    actors_humans   TEXT,
    actors_agents   TEXT,
    context_repo    TEXT,
    context_branch  TEXT,
    decision        TEXT,
    context_section TEXT,
    rationale       TEXT,
    consequences    TEXT,
    key_learnings   TEXT,
    agent_guidance  TEXT,
    file_path       TEXT,
    last_synced     TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS adrs_fts USING fts5(
    adr_id,
    title,
    decision,
    context_section,
    rationale,
    consequences,
    key_learnings,
    agent_guidance,
    content='adrs',
    content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS adrs_ai AFTER INSERT ON adrs BEGIN
    INSERT INTO adrs_fts(rowid, adr_id, title, decision, context_section,
                         rationale, consequences, key_learnings, agent_guidance)
    VALUES (new.rowid, new.adr_id, new.title, new.decision, new.context_section,
            new.rationale, new.consequences, new.key_learnings, new.agent_guidance);
END;

CREATE TRIGGER IF NOT EXISTS adrs_ad AFTER DELETE ON adrs BEGIN
    INSERT INTO adrs_fts(adrs_fts, rowid, adr_id, title, decision, context_section,
                         rationale, consequences, key_learnings, agent_guidance)
    VALUES ('delete', old.rowid, old.adr_id, old.title, old.decision, old.context_section,
            old.rationale, old.consequences, old.key_learnings, old.agent_guidance);
END;

CREATE TRIGGER IF NOT EXISTS adrs_au AFTER UPDATE ON adrs BEGIN
    INSERT INTO adrs_fts(adrs_fts, rowid, adr_id, title, decision, context_section,
                         rationale, consequences, key_learnings, agent_guidance)
    VALUES ('delete', old.rowid, old.adr_id, old.title, old.decision, old.context_section,
            old.rationale, old.consequences, old.key_learnings, old.agent_guidance);
    INSERT INTO adrs_fts(rowid, adr_id, title, decision, context_section,
                         rationale, consequences, key_learnings, agent_guidance)
    VALUES (new.rowid, new.adr_id, new.title, new.decision, new.context_section,
            new.rationale, new.consequences, new.key_learnings, new.agent_guidance);
END;
"""

_UPSERT = """
INSERT INTO adrs (
    adr_id, title, date, status, session_id, session_journey,
    actors_humans, actors_agents, context_repo, context_branch,
    decision, context_section, rationale, consequences,
    key_learnings, agent_guidance, file_path, last_synced
) VALUES (
    :adr_id, :title, :date, :status, :session_id, :session_journey,
    :actors_humans, :actors_agents, :context_repo, :context_branch,
    :decision, :context_section, :rationale, :consequences,
    :key_learnings, :agent_guidance, :file_path, :last_synced
)
ON CONFLICT(adr_id) DO UPDATE SET
    title           = excluded.title,
    date            = excluded.date,
    status          = excluded.status,
    session_id      = excluded.session_id,
    session_journey = excluded.session_journey,
    actors_humans   = excluded.actors_humans,
    actors_agents   = excluded.actors_agents,
    context_repo    = excluded.context_repo,
    context_branch  = excluded.context_branch,
    decision        = excluded.decision,
    context_section = excluded.context_section,
    rationale       = excluded.rationale,
    consequences    = excluded.consequences,
    key_learnings   = excluded.key_learnings,
    agent_guidance  = excluded.agent_guidance,
    file_path       = excluded.file_path,
    last_synced     = excluded.last_synced;
"""


def init_db(db_path: Path) -> sqlite3.Connection:
    """Open (or create) the database and ensure schema exists."""
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.executescript(_SCHEMA)
    return conn


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_sync(conn: sqlite3.Connection, adr_dir: Path) -> int:
    """Parse ADR files and upsert into the database."""
    if not adr_dir.is_dir():
        print(f"ADR directory not found: {adr_dir}", file=sys.stderr)
        return 1

    now = datetime.now(timezone.utc).isoformat()
    count = 0
    disk_ids: set[str] = set()
    for fp in sorted(adr_dir.glob("*.md")):
        record = parse_adr_file(fp)
        if record is None:
            continue
        disk_ids.add(record["adr_id"])
        record["last_synced"] = now
        conn.execute(_UPSERT, record)
        count += 1

    # Remove ADRs that no longer exist on disk
    db_ids = {row["adr_id"] for row in conn.execute("SELECT adr_id FROM adrs")}
    stale = db_ids - disk_ids
    for sid in stale:
        conn.execute("DELETE FROM adrs WHERE adr_id = ?", (sid,))

    conn.commit()
    print(f"Synced {count} ADR(s). Removed {len(stale)} stale record(s).")
    return 0


def cmd_list(conn: sqlite3.Connection) -> int:
    """List all ADRs in compact format."""
    rows = conn.execute(
        "SELECT adr_id, title, date, status FROM adrs ORDER BY adr_id"
    ).fetchall()
    if not rows:
        print("No ADRs in database. Run 'sync' first.")
        return 0
    for r in rows:
        print(f"[{r['adr_id']}] {r['title']}  ({r['status']}, {r['date']})")
    return 0


def cmd_get(conn: sqlite3.Connection, adr_id: str) -> int:
    """Show full details for a single ADR."""
    row = conn.execute("SELECT * FROM adrs WHERE adr_id = ?", (adr_id,)).fetchone()
    if not row:
        print(f"ADR {adr_id} not found.", file=sys.stderr)
        return 1
    for key in row.keys():
        val = row[key]
        if key in ("actors_humans", "actors_agents"):
            val = json.dumps(json.loads(val), indent=2)
        print(f"--- {key} ---")
        print(val)
        print()
    return 0


def cmd_search(conn: sqlite3.Connection, query: str) -> int:
    """Full-text search across ADR content."""
    rows = conn.execute(
        """
        SELECT a.adr_id, a.title, a.status, a.date,
               snippet(adrs_fts, 2, '>>>', '<<<', '...', 32) AS snippet
        FROM adrs_fts
        JOIN adrs a ON a.rowid = adrs_fts.rowid
        WHERE adrs_fts MATCH ?
        ORDER BY rank
        """,
        (query,),
    ).fetchall()
    if not rows:
        print("No results.")
        return 0
    for r in rows:
        print(f"[{r['adr_id']}] {r['title']}  ({r['status']}, {r['date']})")
        if r["snippet"]:
            print(f"  …{r['snippet']}…")
        print()
    return 0


def cmd_summary(conn: sqlite3.Connection) -> int:
    """Produce a compact, agent-friendly summary of all ADRs."""
    rows = conn.execute(
        "SELECT adr_id, title, date, status, decision, key_learnings, agent_guidance "
        "FROM adrs ORDER BY adr_id"
    ).fetchall()
    if not rows:
        print("No ADRs in database. Run 'sync' first.")
        return 0

    parts: list[str] = []
    for r in rows:
        decision_short = (r["decision"] or "")[:300]
        learnings_short = (r["key_learnings"] or "")[:200]
        guidance_short = (r["agent_guidance"] or "")[:200]
        parts.append(
            f"### ADR {r['adr_id']}: {r['title']}\n"
            f"Status: {r['status']} | Date: {r['date']}\n"
            f"Decision: {decision_short}\n"
            f"Learnings: {learnings_short}\n"
            f"Agent Guidance: {guidance_short}\n"
        )
    print("\n".join(parts))
    return 0


# ---------------------------------------------------------------------------
# CLI entry-point
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="EJS ADR Database — SQLite index for Architecture Decision Records",
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=None,
        help="Path to SQLite database (default: <repo>/.ejs-adr.db)",
    )
    parser.add_argument(
        "--adr-dir",
        type=Path,
        default=None,
        help="Path to ADR markdown directory (default: <repo>/ejs-docs/adr)",
    )
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("sync", help="Parse ADR files and update the database")
    sub.add_parser("list", help="List all ADRs")

    p_get = sub.add_parser("get", help="Show full details for an ADR")
    p_get.add_argument("adr_id", help="ADR identifier (e.g. 0010)")

    p_search = sub.add_parser("search", help="Full-text search across ADRs")
    p_search.add_argument("query", help="Search query")

    sub.add_parser("summary", help="Agent-friendly compact summary")

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        return 1

    db_path = args.db or _default_db_path()
    adr_dir = args.adr_dir or _default_adr_dir()

    conn = init_db(db_path)
    try:
        if args.command == "sync":
            return cmd_sync(conn, adr_dir)
        if args.command == "list":
            return cmd_list(conn)
        if args.command == "get":
            return cmd_get(conn, args.adr_id)
        if args.command == "search":
            return cmd_search(conn, args.query)
        if args.command == "summary":
            return cmd_summary(conn)
        parser.print_help()
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
