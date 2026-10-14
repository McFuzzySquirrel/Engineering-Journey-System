# MCP Client Configuration

`dg mcp` starts a local Model Context Protocol server over stdio for the
initialized project in the current working directory. Build decision-graph
first with `npm ci` and `npm run build`. Until the package is published, replace
`/absolute/path/to/Engineering-Journey-System` in the examples with the
repository's absolute path.

The server exposes `search`, `context`, `get`, `related`, `list`, `sdr_add`,
and `lint`. Run it from the project being queried so it reads that project's
`.dg/config.json` and `.dg/graph.db`.

## GitHub Copilot CLI

Add this server to the workspace `.mcp.json` file, or to
`$COPILOT_HOME/mcp-config.json` (normally `~/.copilot/mcp-config.json`) for a
user-level server:

```json
{
  "mcpServers": {
    "decision-graph": {
      "type": "local",
      "command": "node",
      "args": [
        "/absolute/path/to/Engineering-Journey-System/dist/cli.js",
        "mcp"
      ]
    }
  }
}
```

## Visual Studio Code

Add this server to `.vscode/mcp.json` in the workspace:

```json
{
  "servers": {
    "decision-graph": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/absolute/path/to/Engineering-Journey-System/dist/cli.js",
        "mcp"
      ]
    }
  }
}
```

Alternatively, use a workspace-root `.mcp.json` with the Copilot CLI format
above.

## Claude Code

Add this server to the project-root `.mcp.json`:

```json
{
  "mcpServers": {
    "decision-graph": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/absolute/path/to/Engineering-Journey-System/dist/cli.js",
        "mcp"
      ]
    }
  }
}
```

## Cursor

Add this server to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "decision-graph": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/absolute/path/to/Engineering-Journey-System/dist/cli.js",
        "mcp"
      ]
    }
  }
}
```
