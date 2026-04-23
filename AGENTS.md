# AGENTS.md

Setup repository for globally installing AI agent skills and MCP servers across multiple coding tools. The single source of truth for agent tooling on this machine.

## Architecture

```
index.ts          →  setup/skills.ts   →  config/agents.config.ts
                                        →  config/skills.config.ts
               →  setup/mcp.ts        →  config/mcp.config.ts
```

`index.ts` is a pure orchestrator — it calls setup functions and nothing else. All logic lives in `setup/`. All data lives in `config/`.

## File Map

### Entry Point

**`index.ts`** — calls `setupSkills()` and `setupMcp()`. No logic here.

### Setup Layer (`setup/`)

**`setup/skills.ts`** — exports `setupSkills()`. Reads `activeAgents` and `skillsConfig`, then runs `bunx skills add <repo> --skill <name> -g -a <agent> -y` for each skill/agent combination via Bun's shell `$` template.

**`setup/mcp.ts`** — exports `setupMcp()` plus target-specific helpers:
- `setupMcp()` — resolves active MCP targets from `config/agents.config.ts` and runs only the relevant MCP writers.
- `setupClaudeCodeMcp()` — merges `mcpServers` into `~/.claude/settings.json`. Creates the file if absent. Safe to run repeatedly (merges, does not overwrite).
- `setupVscodeMcp()` — merges `mcpServers` (converted to VSCode format) into `%APPDATA%/Code/User/mcp.json` (Windows) or the platform equivalent — the **global** VS Code user config, not a per-workspace file. Preserves existing servers and `inputs` entries.

The key transformation in `setup/mcp.ts`: env var references use `${VAR}` syntax (Claude Code format). When writing the VSCode config, all string values are converted by replacing `${VAR}` → `${env:VAR}`. This is handled by `toVscodeFormat()` and applied recursively across `env`, `headers`, and `args` fields.

### Config Layer (`config/`)

**`config/agents.config.ts`** — list of all supported agents with `enabled` boolean flags plus `mcpTargets`. Exports `agentsConfig` (full list), `activeAgents` (filtered to enabled only, as string IDs), and `activeMcpTargets` (deduplicated MCP config targets derived from enabled agents). Edit `enabled` here to include or exclude agents from all operations.

Supported agent IDs: `claude-code`, `github-copilot`, `antigravity`, `cursor`, `windsurf`, `codex`, `gemini-cli`, `kilo`.

**`config/skills.config.ts`** — array of `{ repo, skills[] }` objects. Each entry maps a GitHub repo to one or more skill names. The `bunx skills add` CLI resolves skills from these repos.

**`config/mcp.config.ts`** — exports `McpServer` type union and `mcpServers` record. Two server shapes:

```ts
// stdio (default transport)
type McpServerStdio = {
  command: string;        // executable, typically "npx"
  args?: string[];        // package name and any positional args
  env?: Record<string, string>;  // env vars passed to the process
  tools?: string[];       // optional tool filter (VSCode-specific)
};

// HTTP transport
type McpServerHttp = {
  type: "http";
  url: string;
  headers?: Record<string, string>;
  tools?: string[];
};
```

All env var values use `${VAR_NAME}` syntax. These are kept as literal strings in `~/.claude/settings.json` (Claude Code expands them at runtime from the system environment). When writing `.vscode/mcp.json`, the setup script converts them to `${env:VAR_NAME}`.

## Where Configs Are Written

| File | Written by | Contents |
|---|---|---|
| `~/.claude/settings.json` | `setupClaudeCodeMcp()` | `mcpServers` key merged in |
| `%APPDATA%/Code/User/mcp.json` | `setupVscodeMcp()` | `servers` key, VSCode format, global |

Skills are installed globally via the `bunx skills` CLI — they write to tool-specific global locations handled by that CLI.

## How to Extend

### Add an agent

In `config/agents.config.ts`, add to `agentsConfig`:
```ts
{ id: "new-agent-id", enabled: true, mcpTargets: [] },
```
The `as const` on the array means the `id` values are typed as string literals. Adding a new entry is safe.

### Add a skill

In `config/skills.config.ts`, add or extend an entry:
```ts
{ repo: "owner/repo", skills: ["skill-name"] },
```

### Add an MCP server

In `config/mcp.config.ts`, add to `mcpServers`:
```ts
"server-key": {
  command: "npx",
  args: ["package-name@version"],
  env: { API_KEY: "${MY_ENV_VAR}" },
},
```
Use `${VAR}` for any value that should be read from the system environment. The setup script handles format conversion automatically.

### Add a new target tool

To write MCP configs for a new tool (e.g., Cursor's `mcp.json`):
1. Add a new export in `setup/mcp.ts` following the pattern of `setupVscodeMcp()`
2. Apply any format transformations that tool requires
3. Call the new function from `index.ts`

## Runtime

The project uses Bun as both runtime and package manager. `index.ts` uses top-level `await` — Bun supports this natively. Shell commands use Bun's `$` template tag from `"bun"`.

Run the setup:
```bash
bun run index.ts  # installs skills + writes MCP configs for the active agents' targets
```
