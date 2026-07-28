#!/usr/bin/env python3
"""
EJS Knowledge Graph — cross-reference index for ADRs, Architecture Blueprint,
README, and Session Journeys.

Builds and maintains `ejs-docs/knowledge-graph/index.json`, a JSON file that
links all living documents for fast, structured agent retrieval.

Usage:
    python scripts/knowledge-graph.py sync               # Rebuild index from all docs
    python scripts/knowledge-graph.py search <query>     # Full-text search across nodes
    python scripts/knowledge-graph.py get <node-id>      # Full details for one node
    python scripts/knowledge-graph.py list               # List all nodes (compact)
    python scripts/knowledge-graph.py list --type adr    # Filter by type

The index is stored at ejs-docs/knowledge-graph/index.json (committed to the repo).
Schema documented at ejs-docs/knowledge-graph/graph-schema.md.
"""

from __future__ import annotations

import argparse
import json
import os
import re
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


def _default_index_path() -> Path:
    return _repo_root() / "ejs-docs" / "knowledge-graph" / "index.json"


# ---------------------------------------------------------------------------
# Frontmatter / markdown parsing
# ---------------------------------------------------------------------------

_FRONTMATTER_RE = re.compile(r"\A---\n(.*?\n)---\n", re.DOTALL)
_ADR_ID_RE = re.compile(r"^\s*adr_id:\s*(\S+)", re.MULTILINE)
_FILENAME_ADR_ID_RE = re.compile(
    r"^(?:adr[_-]?)?(\d+)(?:-[a-zA-Z].*)?\.md$", re.IGNORECASE,
)
# Matches ADR IDs like ADR-0013, 0013, adr-13 inside text
_ADR_REF_RE = re.compile(r"\bADR[-_]?(\d+)\b", re.IGNORECASE)
# Matches session IDs like ejs-session-2026-03-02-01
_SESSION_REF_RE = re.compile(r"ejs-session-\d{4}-\d{2}-\d{2}-\d+")


def _parse_frontmatter(text: str) -> dict[str, Any]:
    m = _FRONTMATTER_RE.match(text)
    if not m:
        return {}
    raw = m.group(1)
    if yaml is not None:
        return yaml.safe_load(raw) or {}
    result: dict[str, Any] = {}
    for line in raw.splitlines():
        if ":" in line and not line.startswith(" "):
            key, _, value = line.partition(":")
            result[key.strip()] = value.strip()
    return result


def _extract_section(text: str, heading: str) -> str:
    pattern = re.compile(
        rf"^(#{{1,2}})\s+{re.escape(heading)}\s*\n(.*?)(?=\n#{{1,2}}\s|\Z)",
        re.MULTILINE | re.DOTALL,
    )
    m = pattern.search(text)
    return m.group(2).strip() if m else ""


def _first_sentence(text: str) -> str:
    """Return the first non-empty sentence of a text block."""
    for line in text.splitlines():
        line = line.strip().lstrip("->• ")
        if line and not line.startswith("#") and not line.startswith("|") and not line.startswith("<!--"):
            # Truncate at sentence boundary
            sentence = re.split(r"(?<=[.!?])\s", line, maxsplit=1)[0]
            return sentence[:200]
    return ""


def _adr_node_id(adr_id: str) -> str:
    """Normalise an ADR identifier to the node ID format 'adr-NNNN'."""
    digits = re.sub(r"[^0-9]", "", str(adr_id))
    return f"adr-{digits.zfill(4)}" if digits else f"adr-{adr_id}"


# ---------------------------------------------------------------------------
# Document parsers
# ---------------------------------------------------------------------------

def _parse_adr_node(filepath: Path, repo_root: Path) -> dict[str, Any] | None:
    """Parse an ADR file into a knowledge graph node."""
    text = filepath.read_text(encoding="utf-8")
    fm = _parse_frontmatter(text)

    adr_id_raw: str = ""
    title: str = ""
    date: str = ""
    tags: list[str] = []
    session_id: str = ""

    if fm:
        ejs = fm.get("ejs", {})
        if isinstance(ejs, dict) and ejs:
            # Extract adr_id from raw text to avoid YAML octal issues
            fm_match = _FRONTMATTER_RE.match(text)
            raw_fm = fm_match.group(1) if fm_match else ""
            id_match = _ADR_ID_RE.search(raw_fm)
            adr_id_raw = id_match.group(1) if id_match else ""
            if not adr_id_raw or adr_id_raw == "XXXX":
                return None
            title = str(ejs.get("title", ""))
            date = str(ejs.get("date", ""))
            session_id = str(ejs.get("session_id", ""))
            tags = list(fm.get("tags", []) or [])
        else:
            return None
    else:
        # Plain / Nygard-format fallback
        title_match = re.search(r"^#\s+(.+)", text, re.MULTILINE)
        if not title_match:
            return None
        raw_title = title_match.group(1).strip()
        id_from_heading = re.match(
            r"(?:ADR[_\s-]*)?(\d+)[\s.:)\-—]+\s*(.*)", raw_title, re.IGNORECASE,
        )
        if id_from_heading:
            adr_id_raw = id_from_heading.group(1)
            title = id_from_heading.group(2).strip() or raw_title
        else:
            fn_match = _FILENAME_ADR_ID_RE.match(filepath.name)
            if not fn_match:
                return None
            adr_id_raw = fn_match.group(1)
            title = raw_title
        # Skip template
        if "template" in title.lower() and adr_id_raw.lstrip("0") in ("", "0"):
            return None
        decision = _extract_section(text, "Decision")
        context_section = _extract_section(text, "Context")
        if not decision and not context_section:
            return None

    node_id = _adr_node_id(adr_id_raw)
    summary = _first_sentence(_extract_section(text, "Decision") or _extract_section(text, "Context"))

    # Find references to other ADRs and sessions in the text
    adr_refs = [_adr_node_id(m) for m in _ADR_REF_RE.findall(text) if _adr_node_id(m) != node_id]
    session_refs = list(dict.fromkeys(_SESSION_REF_RE.findall(text)))

    related: list[str] = list(dict.fromkeys(adr_refs))
    if session_id and session_id not in related:
        related.insert(0, session_id)
    for sr in session_refs:
        if sr not in related:
            related.append(sr)

    return {
        "id": node_id,
        "type": "adr",
        "title": title,
        "path": str(filepath.relative_to(repo_root)),
        "date": date,
        "tags": tags,
        "summary": summary,
        "related": related[:20],  # cap to avoid bloat
        "_session_id": session_id,
        "_adr_id_raw": adr_id_raw,
    }


def _parse_architecture_node(filepath: Path, repo_root: Path) -> dict[str, Any] | None:
    """Parse the architecture blueprint into a knowledge graph node."""
    if not filepath.is_file():
        return None
    text = filepath.read_text(encoding="utf-8")
    fm = _parse_frontmatter(text)

    date = str(fm.get("last_updated", "")) if fm else ""
    session_id = str(fm.get("last_session", "")) if fm else ""

    # Extract title from first H1
    title_match = re.search(r"^#\s+(.+)", text, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else "Architecture Blueprint"

    summary = _first_sentence(_extract_section(text, "System Context"))

    # Find referenced ADRs and sessions
    adr_refs = [_adr_node_id(m) for m in _ADR_REF_RE.findall(text)]
    session_refs = list(dict.fromkeys(_SESSION_REF_RE.findall(text)))
    related = list(dict.fromkeys(adr_refs))
    for sr in session_refs:
        if sr not in related:
            related.append(sr)

    path_rel = str(filepath.relative_to(repo_root))
    return {
        "id": "architecture-blueprint",
        "type": "architecture",
        "title": title,
        "path": path_rel,
        "date": date,
        "tags": ["architecture", "blueprint", "living-doc"],
        "summary": summary,
        "related": related[:20],
        "_session_id": session_id,
    }


def _parse_readme_node(filepath: Path, repo_root: Path) -> dict[str, Any] | None:
    """Parse the README into a knowledge graph node."""
    if not filepath.is_file():
        return None
    text = filepath.read_text(encoding="utf-8")

    title_match = re.search(r"^#\s+(.+)", text, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else "README"

    # Try to extract a summary from the first non-heading paragraph
    summary_match = re.search(r"^>\s+(.+)", text, re.MULTILINE)
    if not summary_match:
        # Fall back: first non-empty, non-heading, non-badge line
        for line in text.splitlines():
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and not stripped.startswith("!") and not stripped.startswith("<!--"):
                summary = stripped[:200]
                break
        else:
            summary = ""
    else:
        summary = summary_match.group(1).strip()[:200]

    # Find date from "Recent Updates" section
    date = ""
    recent = _extract_section(text, "Recent Updates")
    if recent:
        date_match = re.search(r"\*\*(\d{4}-\d{2}-\d{2})\*\*", recent)
        if date_match:
            date = date_match.group(1)

    # Find referenced ADRs and sessions
    adr_refs = [_adr_node_id(m) for m in _ADR_REF_RE.findall(text)]
    session_refs = list(dict.fromkeys(_SESSION_REF_RE.findall(text)))
    related = list(dict.fromkeys(adr_refs))
    for sr in session_refs:
        if sr not in related:
            related.append(sr)
    # Always link to architecture blueprint if mentioned
    if "architecture-blueprint" not in related and "architecture-blueprint.md" in text:
        related.insert(0, "architecture-blueprint")

    return {
        "id": "readme",
        "type": "readme",
        "title": title,
        "path": str(filepath.relative_to(repo_root)),
        "date": date,
        "tags": ["readme", "living-doc", "setup"],
        "summary": summary,
        "related": related[:20],
    }


def _parse_session_node(filepath: Path, repo_root: Path) -> dict[str, Any] | None:
    """Parse a session journey file into a knowledge graph node."""
    text = filepath.read_text(encoding="utf-8")

    fm_match = _FRONTMATTER_RE.match(text)
    if fm_match:
        raw = fm_match.group(1)
        if yaml is not None:
            meta = yaml.safe_load(raw) or {}
            meta = {k: str(v) if not isinstance(v, str) else v for k, v in meta.items()}
        else:
            meta = {}
            for line in raw.splitlines():
                if ":" in line and not line.startswith(" "):
                    k, _, v = line.partition(":")
                    meta[k.strip()] = v.strip()
    else:
        first_heading = re.search(r"^#", text, re.MULTILINE)
        raw = text[: first_heading.start()] if first_heading else text
        meta = {}
        for line in raw.splitlines():
            if ":" in line and not line.startswith(" ") and not line.startswith("#"):
                k, _, v = line.partition(":")
                meta[k.strip()] = v.strip()

    session_id = meta.get("session_id", "").strip()
    if not session_id:
        return None

    date = meta.get("date", "")
    tags_raw = meta.get("tags", "")
    tags: list[str] = []
    if isinstance(tags_raw, list):
        tags = [str(t) for t in tags_raw]
    elif tags_raw:
        tags = [t.strip() for t in str(tags_raw).strip("[]").split(",") if t.strip()]

    adr_links_raw = meta.get("adr_links", "")
    adr_links: list[str] = []
    if isinstance(adr_links_raw, list):
        adr_links = [_adr_node_id(str(a)) for a in adr_links_raw if str(a).strip()]
    elif adr_links_raw and adr_links_raw.strip("[]"):
        adr_links = [_adr_node_id(a.strip()) for a in str(adr_links_raw).strip("[]").split(",") if a.strip()]

    problem = _extract_section(text, "Problem / Intent")
    summary = _first_sentence(problem)

    # Find referenced ADRs in body text
    body_adr_refs = [_adr_node_id(m) for m in _ADR_REF_RE.findall(text)]
    related = list(dict.fromkeys(adr_links + body_adr_refs))

    return {
        "id": session_id,
        "type": "session",
        "title": f"Session: {session_id}",
        "path": str(filepath.relative_to(repo_root)),
        "date": date,
        "tags": tags,
        "summary": summary,
        "related": related[:20],
    }


# ---------------------------------------------------------------------------
# Edge inference
# ---------------------------------------------------------------------------

def _build_edges(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Infer edges from node relationships."""
    edges: list[dict[str, Any]] = []
    node_ids = {n["id"] for n in nodes}

    for node in nodes:
        src = node["id"]
        for related_id in node.get("related", []):
            if related_id not in node_ids:
                continue
            rel = "references"
            if node["type"] == "session" and related_id.startswith("adr-"):
                rel = "triggers"
            elif node["type"] == "adr" and related_id.startswith("ejs-session"):
                rel = "implements"
            elif node["type"] == "architecture":
                rel = "references"
            elif node["type"] == "readme" and related_id == "architecture-blueprint":
                rel = "references"
            edges.append({"from": src, "to": related_id, "rel": rel})

    # ADR session links (from _session_id field)
    for node in nodes:
        if node["type"] == "adr":
            sid = node.get("_session_id", "")
            if sid and sid in node_ids:
                edges.append({"from": sid, "to": node["id"], "rel": "triggers"})

    # Architecture → sessions that updated it (from _session_id)
    for node in nodes:
        if node["type"] == "architecture":
            sid = node.get("_session_id", "")
            if sid and sid in node_ids:
                edges.append({"from": sid, "to": node["id"], "rel": "updates"})

    # Deduplicate
    seen: set[tuple[str, str, str]] = set()
    unique: list[dict[str, Any]] = []
    for e in edges:
        key = (e["from"], e["to"], e["rel"])
        if key not in seen:
            seen.add(key)
            unique.append(e)

    return unique


# ---------------------------------------------------------------------------
# Sync command
# ---------------------------------------------------------------------------

_SKIP_DIRS = frozenset({
    ".git", "node_modules", "dist", "__pycache__", ".pytest_cache",
    ".mypy_cache", ".tox", ".venv", "venv", "_templates",
})


def cmd_sync(index_path: Path | None = None) -> int:
    """Rebuild the knowledge graph index from all living documents."""
    repo_root = _repo_root()
    if index_path is None:
        index_path = _default_index_path()

    index_path.parent.mkdir(parents=True, exist_ok=True)

    nodes: list[dict[str, Any]] = []

    # --- ADRs ---
    adr_dir = repo_root / "ejs-docs" / "adr"
    if adr_dir.is_dir():
        seen_adr_paths: set[Path] = set()
        for fp in sorted(adr_dir.glob("*.md")):
            if fp.resolve() not in seen_adr_paths:
                seen_adr_paths.add(fp.resolve())
                node = _parse_adr_node(fp, repo_root)
                if node:
                    nodes.append(node)
        # Also walk the whole repo for ADRs outside the canonical dir
        for dirpath, dirnames, filenames in os.walk(repo_root):
            dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS]
            dp = Path(dirpath)
            if dp.resolve() == adr_dir.resolve():
                continue
            for fn in sorted(filenames):
                if not fn.endswith(".md"):
                    continue
                fp = dp / fn
                if fp.resolve() in seen_adr_paths:
                    continue
                try:
                    node = _parse_adr_node(fp, repo_root)
                except Exception:  # noqa: BLE001
                    continue
                if node:
                    seen_adr_paths.add(fp.resolve())
                    nodes.append(node)

    # --- Architecture Blueprint ---
    blueprint_path = repo_root / "ejs-docs" / "architecture" / "architecture-blueprint.md"
    arch_node = _parse_architecture_node(blueprint_path, repo_root)
    if arch_node:
        nodes.append(arch_node)

    # --- README ---
    readme_path = repo_root / "README.md"
    readme_node = _parse_readme_node(readme_path, repo_root)
    if readme_node:
        nodes.append(readme_node)

    # --- Session Journeys ---
    journey_dir = repo_root / "ejs-docs" / "journey"
    if journey_dir.is_dir():
        for fp in sorted(journey_dir.rglob("*.md")):
            if "_templates" in fp.parts:
                continue
            try:
                node = _parse_session_node(fp, repo_root)
            except Exception:  # noqa: BLE001
                continue
            if node:
                nodes.append(node)

    # --- Strip internal fields before saving ---
    def _clean(n: dict[str, Any]) -> dict[str, Any]:
        return {k: v for k, v in n.items() if not k.startswith("_")}

    clean_nodes = [_clean(n) for n in nodes]

    # --- Build edges ---
    edges = _build_edges(nodes)  # use nodes with internal fields for edge inference

    index: dict[str, Any] = {
        "schema_version": "1.0",
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "nodes": clean_nodes,
        "edges": edges,
    }

    index_path.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    node_counts = {t: sum(1 for n in clean_nodes if n["type"] == t) for t in ("adr", "architecture", "readme", "session")}
    print(
        f"Knowledge graph synced: {len(clean_nodes)} nodes "
        f"({node_counts['adr']} ADRs, {node_counts['architecture']} architecture, "
        f"{node_counts['readme']} README, {node_counts['session']} sessions), "
        f"{len(edges)} edges → {index_path}"
    )
    return 0


# ---------------------------------------------------------------------------
# Search command
# ---------------------------------------------------------------------------

def cmd_search(query: str, index_path: Path | None = None, top_k: int = 10) -> int:
    """Full-text search across all knowledge graph nodes."""
    if index_path is None:
        index_path = _default_index_path()

    if not index_path.is_file():
        print("Knowledge graph index not found. Run: python scripts/knowledge-graph.py sync", file=sys.stderr)
        return 1

    index = json.loads(index_path.read_text(encoding="utf-8"))
    nodes = index.get("nodes", [])

    query_lower = query.lower()
    query_terms = query_lower.split()

    def _score(node: dict[str, Any]) -> int:
        text = " ".join([
            node.get("title", ""),
            node.get("summary", ""),
            node.get("type", ""),
            " ".join(node.get("tags", [])),
            node.get("id", ""),
        ]).lower()
        return sum(1 for term in query_terms if term in text)

    scored = [(n, _score(n)) for n in nodes]
    scored = [(n, s) for n, s in scored if s > 0]
    scored.sort(key=lambda x: x[1], reverse=True)

    if not scored:
        print(f"No results for: {query!r}")
        return 0

    print(f"Search results for: {query!r}\n")
    for node, score in scored[:top_k]:
        ntype = node.get("type", "?").upper()
        title = node.get("title", "?")
        path = node.get("path", "")
        date = node.get("date", "")
        summary = node.get("summary", "")
        print(f"  [{ntype}] {title}")
        if date:
            print(f"           Date: {date}")
        print(f"           Path: {path}")
        if summary:
            print(f"           {summary}")
        print()
    return 0


# ---------------------------------------------------------------------------
# Get command
# ---------------------------------------------------------------------------

def cmd_get(node_id: str, index_path: Path | None = None) -> int:
    """Print full details for a node by ID."""
    if index_path is None:
        index_path = _default_index_path()

    if not index_path.is_file():
        print("Knowledge graph index not found. Run: python scripts/knowledge-graph.py sync", file=sys.stderr)
        return 1

    index = json.loads(index_path.read_text(encoding="utf-8"))
    nodes = index.get("nodes", [])
    edges = index.get("edges", [])

    node = next((n for n in nodes if n["id"] == node_id), None)
    if node is None:
        # Try partial match
        matches = [n for n in nodes if node_id.lower() in n["id"].lower()]
        if len(matches) == 1:
            node = matches[0]
        elif len(matches) > 1:
            print(f"Ambiguous id {node_id!r}. Matches:")
            for m in matches:
                print(f"  {m['id']} — {m['title']}")
            return 1
        else:
            print(f"Node not found: {node_id!r}")
            return 1

    print(json.dumps(node, indent=2))

    related_edges = [e for e in edges if e["from"] == node["id"] or e["to"] == node["id"]]
    if related_edges:
        print(f"\nEdges ({len(related_edges)}):")
        for e in related_edges:
            direction = "→" if e["from"] == node["id"] else "←"
            other = e["to"] if e["from"] == node["id"] else e["from"]
            print(f"  {direction} {other}  [{e['rel']}]")

    return 0


# ---------------------------------------------------------------------------
# List command
# ---------------------------------------------------------------------------

def cmd_list(node_type: str | None = None, index_path: Path | None = None) -> int:
    """List all nodes in the knowledge graph."""
    if index_path is None:
        index_path = _default_index_path()

    if not index_path.is_file():
        print("Knowledge graph index not found. Run: python scripts/knowledge-graph.py sync", file=sys.stderr)
        return 1

    index = json.loads(index_path.read_text(encoding="utf-8"))
    nodes = index.get("nodes", [])

    if node_type:
        nodes = [n for n in nodes if n.get("type") == node_type]

    if not nodes:
        print(f"No nodes{f' of type {node_type!r}' if node_type else ''}.")
        return 0

    # Group by type
    by_type: dict[str, list[dict[str, Any]]] = {}
    for n in nodes:
        by_type.setdefault(n.get("type", "unknown"), []).append(n)

    for t, group in sorted(by_type.items()):
        print(f"\n{t.upper()} ({len(group)})")
        for n in group:
            date = f"  {n.get('date', '')}" if n.get("date") else ""
            print(f"  {n['id']:<40} {n.get('title', '')[:60]}{date}")

    last_updated = index.get("last_updated", "?")
    print(f"\nTotal: {len(nodes)} nodes  |  Last synced: {last_updated}")
    return 0


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="EJS Knowledge Graph — cross-reference index for living documents.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("sync", help="Rebuild index from all docs")

    p_search = sub.add_parser("search", help="Full-text search across nodes")
    p_search.add_argument("query", nargs="+", help="Search terms")
    p_search.add_argument("--top", type=int, default=10, metavar="N", help="Max results (default: 10)")

    p_get = sub.add_parser("get", help="Full details for a node by ID")
    p_get.add_argument("node_id", help="Node ID (e.g. adr-0013, readme, ejs-session-2026-03-02-01)")

    p_list = sub.add_parser("list", help="List all nodes")
    p_list.add_argument("--type", dest="node_type", choices=["adr", "architecture", "readme", "session"],
                        help="Filter by node type")

    args = parser.parse_args(argv)

    if args.command == "sync":
        return cmd_sync()
    elif args.command == "search":
        return cmd_search(" ".join(args.query), top_k=args.top)
    elif args.command == "get":
        return cmd_get(args.node_id)
    elif args.command == "list":
        return cmd_list(node_type=getattr(args, "node_type", None))
    else:
        parser.print_help()
        return 0


if __name__ == "__main__":
    sys.exit(main())
