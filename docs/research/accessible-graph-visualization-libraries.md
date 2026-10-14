# Research: accessible browser graph-visualization libraries

**Context:** [Issue #38 — Research accessible graph-visualization
libraries](https://github.com/McFuzzySquirrel/Engineering-Journey-System/issues/38),
a child of the map ticket
[#33 — Specify the decision-graph browser UI](https://github.com/McFuzzySquirrel/Engineering-Journey-System/issues/33).
This report answers the research question only; it does not implement the UI
and does not amend the map.

## Question

Which browser graph-visualization library best fits the settled UI
requirements — expandable neighborhoods of project-scoped decision records,
labeled and filterable edge kinds, responsive layout, keyboard accessibility,
and static assets served same-origin by a TypeScript Node package (`dg
serve`, per #33 and ADR-0001#4)?

## Method

Claims below are checked against each project's own documentation, source
code, or issue tracker (not third-party summaries), as of 2026-10-14.
Versions and package facts were read live from the npm registry. Citations
are inline.

## Candidates evaluated

| Library | Current version (npm, 2026-10-14) | Rendering | License |
|---|---|---|---|
| [Cytoscape.js](https://js.cytoscape.org/) | 3.34.3 | Canvas | MIT |
| [vis-network](https://visjs.github.io/vis-network/docs/network/) | 10.1.2 | Canvas | Apache-2.0/MIT dual |
| [Sigma.js](https://www.sigmajs.org/) | 4.0.2 | WebGL | MIT |
| [D3.js](https://d3js.org/) | 7.9.0 | SVG (or Canvas, author's choice) | ISC |
| [Apache ECharts](https://echarts.apache.org/) (graph series) | 6.1.0 | Canvas (SVG renderer optional) | Apache-2.0 |

Versions confirmed via `npm view <pkg> version` against the public npm
registry on 2026-10-14.

## Key finding: none of these libraries ship keyboard-accessible graph
interaction out of the box

This is the dominant fact shaping the recommendation, and it is confirmed
directly by each project, not inferred:

- **Cytoscape.js** renders exclusively to `<canvas>`; the factsheet lists
  canvas support as a hard requirement with no DOM/SVG rendering mode
  (js.cytoscape.org, "Factsheet" section, fetched 2026-10-14;
  `cytoscape/cytoscape.js:documentation/md/intro.md`). A user filed
  [cytoscape/cytoscape.js#3091](https://github.com/cytoscape/cytoscape.js/issues/3091)
  reporting that nodes/edges are unreachable by Tab key using Accessibility
  Insights for Web. The maintainer's response is explicit and still stands as
  the project's position: *"accessibility is something that needs to be
  built at the app level... Cytoscape generally shouldn't, and can't, make
  those decisions for you."* No core keyboard-navigation API exists; the
  issue remains open with no committed fix.
- **vis-network** has the same gap and it is further along in public
  discussion but still unresolved: feature request
  [visjs/vis-network#1767](https://github.com/visjs/vis-network/issues/1767)
  ("Web accessibility" — keyboard node navigation and event firing) is open
  since 2022 with a still-open draft PR
  ([#1824](https://github.com/visjs/vis-network/pull/1824)) that has not
  merged as of 2026-10-14. A related closed issue
  ([#1238](https://github.com/visjs/vis-network/issues/1238)) documents that
  the library's container div ships `tabindex="900"`, which an accessibility
  reviewer flagged as "a no-go" (positive tabindex values break natural tab
  order); the fix only adjusted the attribute, it did not add per-node
  keyboard navigation.
- **Sigma.js** renders via WebGL (sigmajs.org homepage, "WebGL rendering"
  feature callout, fetched 2026-10-14) and documents built-in pan/zoom/hover
  gestures but no keyboard interaction model; a repository issue search found
  no accessibility-tracking issues at all, i.e. it has not been discussed
  publicly by the maintainers.
- **Apache ECharts** is the only candidate with a first-party accessibility
  feature: an `aria` option that generates a natural-language textual
  description of the whole chart for screen readers, implemented in
  `apache/echarts:src/component/aria/preprocessor.ts` (confirmed present in
  the current source tree via the GitHub API, 2026-10-14). This produces one
  static `aria-label`-style summary of the *entire* chart, not per-node focus
  management or keyboard traversal of a graph's neighborhood — it does not
  solve "expand a node and keyboard-navigate its neighbors."
- **D3.js** ships no graph widget and makes no accessibility promises either
  (d3/d3 README, fetched 2026-10-14) — but because D3's idiomatic output for
  node-link diagrams is real SVG DOM elements (`<circle>`, `<g>`, etc.) bound
  to data via selections, each node *is* an addressable DOM element that can
  carry `tabindex`, `role`, and `aria-*` attributes directly. This is a
  structural difference from the canvas/WebGL libraries above: the
  capability to make nodes individually focusable exists natively in the
  DOM, but D3 does not provide it — the integrating application must still
  write all the keyboard/ARIA wiring and the force-directed layout
  composition (`d3-force`, `d3-drag`, `d3-zoom`) by hand.

## The applicable accessibility pattern (W3C ARIA Authoring Practices)

There is no WAI-ARIA design pattern named "graph" or "network diagram." The
closest applicable pattern is the
[Tree View pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)
(W3C ARIA Authoring Practices Guide, fetched 2026-10-14): *"a tree view
widget presents a hierarchical list... items that have children may be
expanded or collapsed to show or hide the children"* with keyboard
expand/collapse semantics (`aria-expanded`, arrow-key traversal). This maps
cleanly onto "expandable neighborhoods of decision records": each expansion
of a record's neighborhood is structurally a disclosure of child items,
which is exactly what the tree view pattern specifies keyboard and ARIA
behavior for.

The practical implication, consistent with the Cytoscape maintainer's
guidance above, is that **keyboard accessibility for this UI is not a
library-selection problem alone — it requires a synchronized accessible DOM
representation** (e.g., a tree/list view implementing the APG Tree View
pattern) alongside whichever canvas/SVG visual the library draws, because
canvas and WebGL content is invisible to assistive technology regardless of
which charting library produces it.

## Feature fit against the settled requirements

| Requirement | Cytoscape.js | vis-network | Sigma.js | D3.js | ECharts |
|---|---|---|---|---|---|
| Expandable neighborhoods | Native `collection.neighborhood()` API returns connected nodes/edges for incremental reveal (`cytoscape/cytoscape.js:documentation/md/collection/neighborhood.md`); actively maintained `cytoscape.js-expand-collapse` extension exists for compound expand/collapse (last push 2024-11-27, 140 stars, not archived — confirmed via GitHub API) | Possible via manual DataSet add/remove; no first-party neighborhood helper found in the docs index fetched | Possible via manual graphology data-store operations; no first-party helper | Fully manual: compute neighbors from your own data model and re-render the `d3-force` simulation | Graph series supports data updates, but no first-party "expand one node's neighborhood" API found |
| Labeled, filterable edges | Core selector engine lets you query/filter by edge class or data attribute and core style rules label edges directly | Core `edges` module supports labels and group-based filtering | Supports edge types via graphology attributes; labeling is manual | Fully manual (your own filter predicates over SVG/data join) | Edge `label` and category filtering supported in graph series option schema |
| Responsive layout | Resize handled by calling `cy.resize()`/`cy.fit()`; app must wire the resize observer | Network redraws on container resize; documented as "works smooth on any modern browser" but responsiveness wiring is app-level | Renderer exposes `refresh()`/resize handling; app-level wiring | Fully manual — SVG `viewBox` + resize listener is idiomatic D3 | Built-in `resize()` method, same pattern as the others |
| Keyboard accessibility | **Not solved by the library** (see above) | **Not solved by the library**; feature request open 4+ years | **Not solved by the library**; no tracked discussion | **Not solved by the library**, but DOM nodes make it buildable without a shadow/parallel structure | Only a whole-chart screen-reader summary, not interactive keyboard graph traversal |
| Same-origin static asset serving by a TS Node package | Plain npm package, no server assumptions, ships ESM/UMD/CJS builds — trivially bundled and served statically | Same — npm package with standalone/peer/ESM builds | Same — npm package, framework-agnostic | Same — npm, ESM-first micro-modules | Same — npm package; larger payload (see below) |

## Integration cost and payload

Measured via the public Bundlephobia API on 2026-10-14 (minified+gzip):

- Cytoscape.js: ~137 KB gzip (435 KB min) for the full core library, no
  external dependencies.
- Sigma.js: ~96.5 KB gzip (374 KB min); requires `graphology` as a
  companion data-model dependency (not bundled in that figure).
- D3.js (full `d3` meta-package): ~92 KB gzip (279 KB min), but real-world
  usage only needs a handful of modules (`d3-selection`, `d3-force`,
  `d3-drag`, `d3-zoom`), so an integration that imports only those is
  smaller in practice; the cost instead shows up as engineering time to
  hand-build layout, interaction, and ARIA wiring.
- Apache ECharts: ~368 KB gzip (1.1 MB min) for the full build; ECharts
  supports partial/custom builds to shrink this, at added build-config cost.
- vis-network: Bundlephobia's API did not return a size for this package at
  fetch time (no data), so no figure is reported here; its own docs note
  three build variants (standalone/peer/legacy) with different
  dependency-bundling tradeoffs (`visjs.github.io/vis-network/docs/network/`,
  "Creating a Network" section).

All five are plain npm packages with browser-ready builds (ESM/UMD or
ESM-only), so all are equally straightforward for a TypeScript Node package
to bundle and serve as same-origin static assets — this requirement does not
differentiate the candidates.

## Recommendation

**Cytoscape.js**, paired with a hand-built, synchronized accessible DOM tree
view (per the W3C APG Tree View pattern) that mirrors the canvas graph's
expand/collapse state, is the best fit.

Reasoning:

- It is the only candidate with first-party, documented support for exactly
  the interaction this UI needs: querying a record's neighborhood
  (`collection.neighborhood()`) and a mature, actively-maintained
  expand/collapse extension, rather than requiring the integrating team to
  invent both the data-traversal and the expand/collapse UX from scratch (as
  D3 would require).
- Its selector/style engine directly expresses "labeled, filterable edge
  kinds" as a first-class concept (style rules keyed to edge data/classes),
  avoiding bespoke filter-predicate code that D3 or Sigma would need.
- No dependency (`graphology` is not needed, unlike Sigma.js), keeping the
  same-origin static bundle simpler.
- Its gzip footprint (~137 KB) is mid-pack: larger than D3's core modules
  but far smaller than ECharts, for materially more out-of-the-box graph
  functionality than D3 provides unassisted.

**Material tradeoff and accessibility caveat (must be designed, not
assumed):** Cytoscape.js provides *zero* built-in keyboard accessibility —
this is confirmed by the maintainer directly, not merely absent from docs.
Shipping this UI with only the canvas view would fail the "keyboard
accessible" requirement outright. The project must budget for a second,
synchronized DOM-based representation (a tree/list honoring the APG Tree
View keyboard pattern: arrow-key traversal, `aria-expanded` disclosure,
visible focus) that exposes the same expand/neighborhood/filter operations
the canvas offers, with the canvas treated as a progressive-enhancement
visual layer on top of that accessible structure. This is extra, non-trivial
build effort beyond wiring the charting library itself, and it is the same
effort any of the five candidates would require — Cytoscape.js does not
make it larger, it just does not make it smaller either.

**Runner-up:** D3.js, if the team wants complete control over DOM structure
from the outset (e.g., to make accessibility markup co-designed with layout
from day one rather than retrofitted onto a canvas library). The cost is
building neighborhood traversal, expand/collapse state, edge filtering, and
responsive layout entirely from primitive modules — materially more
integration work than Cytoscape.js provides natively, for no accessibility
benefit that Cytoscape.js's paired-DOM-tree approach doesn't already
deliver.

**Not recommended:** vis-network (accessibility feature request open and
unmerged for 4+ years, signaling it is not a near-term priority for that
project; also carries a documented history of accessibility-harming default
markup); Sigma.js (WebGL-only, additional `graphology` dependency, no
accessibility discussion found in the tracker at all, a flag that it has not
been considered by maintainers); Apache ECharts (`aria` option only
produces a whole-chart static summary, not interactive per-node keyboard
support, while costing roughly 2.5x Cytoscape.js's gzip payload for a
general-purpose charting library, most of which is irrelevant to a
decision-record graph).

## Facts vs. open decisions

**Facts established by this research (verified against primary sources):**

- None of the five candidate libraries provide built-in keyboard-accessible
  graph node/edge traversal.
- Cytoscape.js and D3.js render fundamentally differently (canvas vs. SVG
  DOM), which matters for how hard it is to retrofit accessible markup.
- Cytoscape.js has a native neighborhood-query API and an actively
  maintained expand/collapse extension; the other candidates do not have an
  equivalent first-party primitive.
- The W3C ARIA Authoring Practices Guide's Tree View pattern is the closest
  standard pattern for keyboard-accessible expand/collapse of hierarchical
  neighborhoods, and none of the candidate libraries implement it for the
  user.
- All five candidates are plain npm packages compatible with being bundled
  and served as same-origin static assets by a TypeScript Node package; this
  criterion does not differentiate them.

**Open decisions this report does not make (left to implementation/map
follow-up):**

- The exact design of the synchronized accessible DOM tree view (visual
  design, exact ARIA role/state wiring, how focus moves between the tree and
  the canvas) is not specified here — that is UI design/prototyping work,
  out of scope for this research ticket.
- Whether to vendor a prebuilt expand/collapse extension
  (`cytoscape.js-expand-collapse`) or write bespoke neighborhood-expansion
  code directly against `collection.neighborhood()` is an implementation
  choice, not resolved here.
- Exact bundle-size budget/performance targets for the served static assets
  are not defined in the map or this ticket and are not assessed here beyond
  reporting current gzip sizes.
- Browser/version support matrix beyond each library's own stated baseline
  (e.g., Cytoscape.js's ES5+canvas baseline) was not independently
  re-verified against this project's actual target browser list.

## Sources consulted

- https://js.cytoscape.org/ (fetched 2026-10-14)
- `cytoscape/cytoscape.js:documentation/md/intro.md` and
  `documentation/md/collection/neighborhood.md` (GitHub API, fetched
  2026-10-14)
- https://github.com/cytoscape/cytoscape.js/issues/3091
- https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse (GitHub
  API metadata, fetched 2026-10-14)
- https://visjs.github.io/vis-network/docs/network/ (fetched 2026-10-14)
- https://github.com/visjs/vis-network/issues/1767
- https://github.com/visjs/vis-network/pull/1824
- https://github.com/visjs/vis-network/issues/1238
- https://www.sigmajs.org/ (fetched 2026-10-14)
- https://raw.githubusercontent.com/d3/d3/main/README.md (fetched
  2026-10-14)
- `apache/echarts:src/component/aria/preprocessor.ts` (GitHub API, fetched
  2026-10-14)
- https://www.w3.org/WAI/ARIA/apg/patterns/treeview/ (fetched 2026-10-14)
- npm registry (`npm view <package> version`), fetched 2026-10-14, for
  cytoscape, vis-network, sigma, d3, echarts
- Bundlephobia public API (`bundlephobia.com/api/size`), fetched 2026-10-14,
  for cytoscape, sigma, d3, echarts (vis-network returned no data)
