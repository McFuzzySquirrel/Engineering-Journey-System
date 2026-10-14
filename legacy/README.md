# Engineering Journey System archive

This directory preserves the Engineering Journey System (EJS) while the
repository pivots to decision-graph. EJS captured session journeys,
collaboration trails, decisions, and architecture decision records.

The unmodified tracked repository state is available at the
[`ejs-final` tag](https://github.com/McFuzzySquirrel/Engineering-Journey-System/tree/ejs-final).
The original documentation is preserved in [EJS-README.md](EJS-README.md).

## Archive contents

- `ejs-docs/`: ADRs, session journeys, research, templates, and narratives.
- `scripts/`: the Python database indexer, tests, and bootstrap scripts.
- `.github/`: the former hooks, skills, agent profile, recording instructions,
  and pull request template.
- `_posts/` and `logs/`: historical articles and local audit artifacts.

These files are historical reference material, not maintained runtime tooling.
Paths in archived documentation and scripts retain their original meaning
relative to the old repository root; they have not been rewritten.
The archived hooks and skills are outside the active `.github/` directories
and must not be installed or executed as part of decision-graph development.

Generated EJS database and session-marker files were removed. Existing
untracked journeys and ignored audit logs were preserved locally in this
archive; they are not automatically added to version control.

Follow the [implementation plan](../docs/IMPLEMENTATION-PLAN.md) for current work.
