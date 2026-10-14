<!-- dg:begin -->
Run `dg context <files>` before editing.
Record decisions with `dg sdr add`.
MCP server: `dg mcp`.

## Accepted rules
ADR-0001#1 [**/*] MUST Treat versioned Markdown decision records as the source of truth; rebuild the local index from those files.
ADR-0001#2 [**/*] MUST NOT Run archived EJS hooks, skills, bootstrap scripts, or session-recording workflows.
ADR-0001#3 [**/*] SHOULD Run `dg context <files...>` before editing code and use `dg sdr add` to capture significant session decisions.
ADR-0001#4 [**/*] MUST Keep unauthenticated decision-graph servers bound to localhost or a trusted network.
<!-- dg:end -->
