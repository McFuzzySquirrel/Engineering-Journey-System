"""Tests for the EJS Knowledge Graph tool (scripts/knowledge-graph.py)."""

from __future__ import annotations

import json
import os
import textwrap
import unittest
from pathlib import Path
from unittest import mock

import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from importlib import import_module

kg = import_module("knowledge-graph")


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SAMPLE_ADR_EJS = textwrap.dedent("""\
    ---
    ejs:
      type: journey-adr
      version: 1.1
      adr_id: 0042
      title: Adopt SQLite for ADR Tracking
      date: 2026-03-02
      status: accepted
      session_id: ejs-session-2026-03-02-01
      session_journey: ejs-docs/journey/2026/ejs-session-2026-03-02-01.md

    actors:
      humans:
        - id: alice
          role: lead-engineer
      agents:
        - id: copilot
          role: coding-agent

    context:
      repo: my-repo
      branch: main
    ---

    # Context

    Agents need a fast way to look up past decisions.

    # Decision

    Adopt SQLite for ADR tracking.

    # Rationale

    SQLite is lightweight and zero-config.
""")

SAMPLE_ADR_PLAIN = textwrap.dedent("""\
    # 5. Use PostgreSQL for primary storage

    ## Status

    Accepted

    ## Context

    We need a relational database for user data.

    ## Decision

    Use PostgreSQL as the primary datastore.

    ## Consequences

    Requires a running Postgres instance.
""")

SAMPLE_JOURNEY = textwrap.dedent("""\
    session_id: ejs-session-2026-04-01-01
    author: bob
    date: 2026-04-01
    repo: my-repo
    branch: feature/kg
    agents_involved: [copilot]
    decision_detected: false
    adr_links: [0042]
    tags: [knowledge-graph]
    refs: []

    # Problem / Intent
    Build a knowledge graph index for fast agent retrieval.

    # Interaction Summary (Required)
    - Human: asked to build knowledge graph
      - Agent [copilot]: implemented knowledge-graph.py
      - Outcome: graph index created

    # Decisions Made
    - Decision: Use JSON for graph index
      - Reason: portable and diffable
      - Impact: index is committed to repo
""")

SAMPLE_BLUEPRINT = textwrap.dedent("""\
    ---
    doc_type: architecture-blueprint
    version: 1.0
    repo: my-repo
    last_updated: 2026-04-01
    last_session: ejs-session-2026-04-01-01
    ---

    # Architecture Blueprint — my-repo

    ## System Context

    Users interact via CLI. External integrations: GitHub API.

    ## Tech Decisions

    | Decision | Choice | Rationale | ADR |
    |---|---|---|---|
    | Storage | SQLite | lightweight | ADR-0042 |
""")

SAMPLE_README = textwrap.dedent("""\
    # My Project

    > A tool for managing engineering decisions.

    ## Overview

    This project tracks architectural decisions using EJS.

    ## Recent Updates

    - **2026-04-01** — Initial release (session: `ejs-session-2026-04-01-01`)
""")


# ---------------------------------------------------------------------------
# Helper: create a temp file tree
# ---------------------------------------------------------------------------

class TempRepo:
    """Context manager that creates a minimal fake repo for testing."""

    def __init__(self, tmp_path: Path):
        self.root = tmp_path
        (tmp_path / "ejs-docs" / "adr").mkdir(parents=True)
        (tmp_path / "ejs-docs" / "architecture").mkdir(parents=True)
        (tmp_path / "ejs-docs" / "journey" / "2026").mkdir(parents=True)
        (tmp_path / "ejs-docs" / "knowledge-graph").mkdir(parents=True)

    def write(self, rel_path: str, content: str) -> Path:
        p = self.root / rel_path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return p


# ---------------------------------------------------------------------------
# Unit tests: parsers
# ---------------------------------------------------------------------------

class TestParseADRNode(unittest.TestCase):

    def _write_adr(self, content: str) -> Path:
        import tempfile
        d = Path(tempfile.mkdtemp())
        fp = d / "0042-adopt-sqlite.md"
        fp.write_text(content, encoding="utf-8")
        return fp

    def test_ejs_format(self):
        fp = self._write_adr(SAMPLE_ADR_EJS)
        node = kg._parse_adr_node(fp, fp.parent)
        self.assertIsNotNone(node)
        self.assertEqual(node["id"], "adr-0042")
        self.assertEqual(node["type"], "adr")
        self.assertIn("SQLite", node["title"])
        self.assertEqual(node["date"], "2026-03-02")
        self.assertIn("ejs-session-2026-03-02-01", node["_session_id"])

    def test_plain_format(self):
        fp = self._write_adr(SAMPLE_ADR_PLAIN)
        node = kg._parse_adr_node(fp, fp.parent)
        self.assertIsNotNone(node)
        self.assertEqual(node["id"], "adr-0042")  # derived from filename
        self.assertEqual(node["type"], "adr")

    def test_template_skipped(self):
        import tempfile
        d = Path(tempfile.mkdtemp())
        fp = d / "0000-adr-template.md"
        fp.write_text("---\nejs:\n  adr_id: XXXX\n  title: Template\n---\n# Context\nTemplate\n", encoding="utf-8")
        node = kg._parse_adr_node(fp, fp.parent)
        self.assertIsNone(node)

    def test_no_decision_or_context_skipped(self):
        import tempfile
        d = Path(tempfile.mkdtemp())
        fp = d / "0099-notes.md"
        fp.write_text("# Notes\nJust some notes.\n", encoding="utf-8")
        node = kg._parse_adr_node(fp, fp.parent)
        self.assertIsNone(node)


class TestParseArchitectureNode(unittest.TestCase):

    def test_parse_blueprint(self):
        import tempfile
        root = Path(tempfile.mkdtemp())
        fp = root / "ejs-docs" / "architecture" / "architecture-blueprint.md"
        fp.parent.mkdir(parents=True)
        fp.write_text(SAMPLE_BLUEPRINT, encoding="utf-8")
        node = kg._parse_architecture_node(fp, root)
        self.assertIsNotNone(node)
        self.assertEqual(node["id"], "architecture-blueprint")
        self.assertEqual(node["type"], "architecture")
        self.assertEqual(node["date"], "2026-04-01")
        self.assertIn("adr-0042", node["related"])
        self.assertIn("ejs-session-2026-04-01-01", node["related"])

    def test_missing_file_returns_none(self):
        import tempfile
        root = Path(tempfile.mkdtemp())
        fp = root / "ejs-docs" / "architecture" / "architecture-blueprint.md"
        node = kg._parse_architecture_node(fp, root)
        self.assertIsNone(node)


class TestParseReadmeNode(unittest.TestCase):

    def test_parse_readme(self):
        import tempfile
        root = Path(tempfile.mkdtemp())
        fp = root / "README.md"
        fp.write_text(SAMPLE_README, encoding="utf-8")
        node = kg._parse_readme_node(fp, root)
        self.assertIsNotNone(node)
        self.assertEqual(node["id"], "readme")
        self.assertEqual(node["type"], "readme")
        self.assertEqual(node["date"], "2026-04-01")
        self.assertIn("management", node["summary"].lower())

    def test_missing_readme_returns_none(self):
        import tempfile
        root = Path(tempfile.mkdtemp())
        fp = root / "README.md"
        node = kg._parse_readme_node(fp, root)
        self.assertIsNone(node)


class TestParseSessionNode(unittest.TestCase):

    def test_parse_journey(self):
        import tempfile
        root = Path(tempfile.mkdtemp())
        fp = root / "ejs-docs" / "journey" / "2026" / "ejs-session-2026-04-01-01.md"
        fp.parent.mkdir(parents=True)
        fp.write_text(SAMPLE_JOURNEY, encoding="utf-8")
        node = kg._parse_session_node(fp, root)
        self.assertIsNotNone(node)
        self.assertEqual(node["id"], "ejs-session-2026-04-01-01")
        self.assertEqual(node["type"], "session")
        self.assertEqual(node["date"], "2026-04-01")
        self.assertIn("knowledge graph", node["summary"].lower())
        self.assertIn("adr-0042", node["related"])

    def test_no_session_id_returns_none(self):
        import tempfile
        root = Path(tempfile.mkdtemp())
        fp = root / "ejs-docs" / "journey" / "_templates" / "journey-template.md"
        fp.parent.mkdir(parents=True)
        fp.write_text("# Template\nNo session id here.\n", encoding="utf-8")
        node = kg._parse_session_node(fp, root)
        self.assertIsNone(node)


# ---------------------------------------------------------------------------
# Unit tests: edge inference
# ---------------------------------------------------------------------------

class TestBuildEdges(unittest.TestCase):

    def test_adr_session_edge(self):
        nodes = [
            {"id": "adr-0042", "type": "adr", "related": ["ejs-session-2026-03-02-01"], "_session_id": "ejs-session-2026-03-02-01"},
            {"id": "ejs-session-2026-03-02-01", "type": "session", "related": []},
        ]
        edges = kg._build_edges(nodes)
        rels = {(e["from"], e["to"], e["rel"]) for e in edges}
        self.assertIn(("adr-0042", "ejs-session-2026-03-02-01", "implements"), rels)
        self.assertIn(("ejs-session-2026-03-02-01", "adr-0042", "triggers"), rels)

    def test_architecture_references_adr(self):
        nodes = [
            {"id": "architecture-blueprint", "type": "architecture", "related": ["adr-0042"], "_session_id": ""},
            {"id": "adr-0042", "type": "adr", "related": [], "_session_id": ""},
        ]
        edges = kg._build_edges(nodes)
        rels = {(e["from"], e["to"], e["rel"]) for e in edges}
        self.assertIn(("architecture-blueprint", "adr-0042", "references"), rels)

    def test_no_duplicate_edges(self):
        nodes = [
            {"id": "adr-0042", "type": "adr", "related": ["ejs-session-2026-03-02-01"], "_session_id": "ejs-session-2026-03-02-01"},
            {"id": "ejs-session-2026-03-02-01", "type": "session", "related": []},
        ]
        edges = kg._build_edges(nodes)
        seen: set[tuple[str, str, str]] = set()
        for e in edges:
            key = (e["from"], e["to"], e["rel"])
            self.assertNotIn(key, seen, f"Duplicate edge: {key}")
            seen.add(key)

    def test_edges_only_reference_existing_nodes(self):
        nodes = [
            {"id": "adr-0042", "type": "adr", "related": ["nonexistent-node"], "_session_id": ""},
        ]
        edges = kg._build_edges(nodes)
        for e in edges:
            self.assertNotEqual(e["to"], "nonexistent-node")


# ---------------------------------------------------------------------------
# Integration tests: sync + search + get + list
# ---------------------------------------------------------------------------

class TestSync(unittest.TestCase):

    def setUp(self):
        import tempfile
        self.tmp = Path(tempfile.mkdtemp())
        self.repo = TempRepo(self.tmp)
        self.index_path = self.tmp / "ejs-docs" / "knowledge-graph" / "index.json"

    def _sync(self):
        with mock.patch.object(kg, "_repo_root", return_value=self.tmp):
            return kg.cmd_sync(index_path=self.index_path)

    def test_sync_creates_index(self):
        self.repo.write("ejs-docs/adr/0042-adopt-sqlite.md", SAMPLE_ADR_EJS)
        rc = self._sync()
        self.assertEqual(rc, 0)
        self.assertTrue(self.index_path.is_file())
        data = json.loads(self.index_path.read_text())
        self.assertIn("nodes", data)
        self.assertIn("edges", data)
        self.assertEqual(data["schema_version"], "1.0")

    def test_sync_indexes_all_doc_types(self):
        self.repo.write("ejs-docs/adr/0042-adopt-sqlite.md", SAMPLE_ADR_EJS)
        self.repo.write("ejs-docs/architecture/architecture-blueprint.md", SAMPLE_BLUEPRINT)
        self.repo.write("README.md", SAMPLE_README)
        self.repo.write("ejs-docs/journey/2026/ejs-session-2026-04-01-01.md", SAMPLE_JOURNEY)
        self._sync()
        data = json.loads(self.index_path.read_text())
        types = {n["type"] for n in data["nodes"]}
        self.assertIn("adr", types)
        self.assertIn("architecture", types)
        self.assertIn("readme", types)
        self.assertIn("session", types)

    def test_sync_no_internal_fields_in_output(self):
        self.repo.write("ejs-docs/adr/0042-adopt-sqlite.md", SAMPLE_ADR_EJS)
        self._sync()
        data = json.loads(self.index_path.read_text())
        for node in data["nodes"]:
            for key in node:
                self.assertFalse(key.startswith("_"), f"Internal field leaked: {key}")

    def test_sync_idempotent(self):
        self.repo.write("ejs-docs/adr/0042-adopt-sqlite.md", SAMPLE_ADR_EJS)
        self._sync()
        first = json.loads(self.index_path.read_text())
        self._sync()
        second = json.loads(self.index_path.read_text())
        self.assertEqual(first["nodes"], second["nodes"])
        self.assertEqual(first["edges"], second["edges"])


class TestSearch(unittest.TestCase):

    def setUp(self):
        import tempfile
        self.tmp = Path(tempfile.mkdtemp())
        self.repo = TempRepo(self.tmp)
        self.index_path = self.tmp / "ejs-docs" / "knowledge-graph" / "index.json"
        self.repo.write("ejs-docs/adr/0042-adopt-sqlite.md", SAMPLE_ADR_EJS)
        self.repo.write("ejs-docs/architecture/architecture-blueprint.md", SAMPLE_BLUEPRINT)
        self.repo.write("ejs-docs/journey/2026/ejs-session-2026-04-01-01.md", SAMPLE_JOURNEY)
        with mock.patch.object(kg, "_repo_root", return_value=self.tmp):
            kg.cmd_sync(index_path=self.index_path)

    def test_search_finds_adr(self):
        import io
        from contextlib import redirect_stdout
        buf = io.StringIO()
        with redirect_stdout(buf):
            rc = kg.cmd_search("sqlite", index_path=self.index_path)
        self.assertEqual(rc, 0)
        output = buf.getvalue()
        self.assertIn("SQLite", output)

    def test_search_no_results(self):
        import io
        from contextlib import redirect_stdout
        buf = io.StringIO()
        with redirect_stdout(buf):
            rc = kg.cmd_search("xyzzy12345", index_path=self.index_path)
        self.assertEqual(rc, 0)
        self.assertIn("No results", buf.getvalue())

    def test_search_missing_index(self):
        rc = kg.cmd_search("sqlite", index_path=Path("/nonexistent/index.json"))
        self.assertEqual(rc, 1)


class TestGet(unittest.TestCase):

    def setUp(self):
        import tempfile
        self.tmp = Path(tempfile.mkdtemp())
        self.repo = TempRepo(self.tmp)
        self.index_path = self.tmp / "ejs-docs" / "knowledge-graph" / "index.json"
        self.repo.write("ejs-docs/adr/0042-adopt-sqlite.md", SAMPLE_ADR_EJS)
        with mock.patch.object(kg, "_repo_root", return_value=self.tmp):
            kg.cmd_sync(index_path=self.index_path)

    def test_get_existing_node(self):
        import io
        from contextlib import redirect_stdout
        buf = io.StringIO()
        with redirect_stdout(buf):
            rc = kg.cmd_get("adr-0042", index_path=self.index_path)
        self.assertEqual(rc, 0)
        data = json.loads(buf.getvalue().split("\n\n")[0])  # first JSON block
        self.assertEqual(data["id"], "adr-0042")

    def test_get_missing_node(self):
        rc = kg.cmd_get("adr-9999", index_path=self.index_path)
        self.assertEqual(rc, 1)


class TestList(unittest.TestCase):

    def setUp(self):
        import tempfile
        self.tmp = Path(tempfile.mkdtemp())
        self.repo = TempRepo(self.tmp)
        self.index_path = self.tmp / "ejs-docs" / "knowledge-graph" / "index.json"
        self.repo.write("ejs-docs/adr/0042-adopt-sqlite.md", SAMPLE_ADR_EJS)
        self.repo.write("ejs-docs/architecture/architecture-blueprint.md", SAMPLE_BLUEPRINT)
        with mock.patch.object(kg, "_repo_root", return_value=self.tmp):
            kg.cmd_sync(index_path=self.index_path)

    def test_list_all(self):
        import io
        from contextlib import redirect_stdout
        buf = io.StringIO()
        with redirect_stdout(buf):
            rc = kg.cmd_list(index_path=self.index_path)
        self.assertEqual(rc, 0)
        self.assertIn("adr-0042", buf.getvalue())
        self.assertIn("architecture-blueprint", buf.getvalue())

    def test_list_filter_by_type(self):
        import io
        from contextlib import redirect_stdout
        buf = io.StringIO()
        with redirect_stdout(buf):
            rc = kg.cmd_list(node_type="adr", index_path=self.index_path)
        self.assertEqual(rc, 0)
        self.assertIn("adr-0042", buf.getvalue())
        self.assertNotIn("architecture-blueprint", buf.getvalue())


# ---------------------------------------------------------------------------
# Utility function tests
# ---------------------------------------------------------------------------

class TestUtilityFunctions(unittest.TestCase):

    def test_adr_node_id_numeric(self):
        self.assertEqual(kg._adr_node_id("42"), "adr-0042")
        self.assertEqual(kg._adr_node_id("0013"), "adr-0013")

    def test_adr_node_id_already_prefixed(self):
        self.assertEqual(kg._adr_node_id("ADR-0013"), "adr-0013")

    def test_first_sentence_basic(self):
        text = "This is the first sentence. And a second."
        self.assertEqual(kg._first_sentence(text), "This is the first sentence.")

    def test_first_sentence_skips_headings(self):
        text = "## Heading\nFirst real sentence."
        self.assertEqual(kg._first_sentence(text), "First real sentence.")

    def test_first_sentence_empty(self):
        self.assertEqual(kg._first_sentence(""), "")


if __name__ == "__main__":
    unittest.main()
