# AGENTS.md

Setup repository for globally installing AI agent skills and MCP servers across multiple coding tools. The single source of truth for agent tooling on this machine.

## Release Flow

After the one-time setup below, new npm releases can be published directly from GitHub.

### One-time repository setup

Configure npm Trusted Publishing for `@evgenest/ai-agents-arsenal` in the package's Access settings.

Use this GitHub identity:
- owner: `evgenest`
- repository: `ai-agents-arsenal`
- workflow file: `publish-npm.yml`

This workflow uses GitHub Actions OIDC, so no `NPM_TOKEN` repository secret is required.

### For each new release

1. Update `package.json` and `CHANGELOG.md` to the new version.
2. Push the version bump to `main`.
3. Create a GitHub Release whose tag matches the package version, for example `v4.3.1`.

When the release is published, GitHub Actions checks out that tag, uses a Node LTS runtime with a Trusted Publishing-compatible npm, runs `bun test` plus `bun run typecheck`, verifies that the tag matches `package.json`, and then runs `npm publish --provenance --access public` automatically via OIDC.

You do not need to run `npm publish` locally for normal releases once Trusted Publisher is configured on npm.

## Architecture

```
index.ts          →  setup/run.ts      →  setup/skills.ts   →  config/agents.config.ts
                                                         →  config/skills.config.ts
                                      →  setup/mcp.ts      →  setup/mcp/targets/*.ts
                                                         →  setup/mcp/core/*.ts
                                                         →  config/mcp.config.ts
```

`index.ts` is the CLI entry point for both local repo usage and the published npm package — it calls `runSetup()` and nothing else. All logic lives in `setup/`. All data lives in `config/`.

## File Map

### Entry Point

**`index.ts`** — npm/bin entry point with a Bun shebang; calls `setupSkills()` and `setupMcp()`. No logic here.

### Setup Layer (`setup/`)

**`setup/run.ts`** — exports `runSetup()`. Parses CLI flags and chooses which setup phases to run. Supported flags: `--skills`, `--mcp`, `--project`, `--agents-config`, `--skills-config`, `--mcp-config`, and `--help`. With no phase flags, it runs both skills and MCP setup. Before applying changes it prints a phase-specific preview of the loaded setup.

**`setup/config.ts`** — runtime config loader. Resolves default versus user-provided config paths, imports config modules dynamically, validates their exports, and derives `activeAgents` plus `activeMcpTargets` from the loaded agent config.

**`setup/preflight.ts`** — renders the setup preview shown before installation. Prints phase-specific details for skills and MCP along with config source info, environment variable references, and override flag hints.

**`setup/skills.ts`** — exports `setupSkills()`. Receives `activeAgents` and `skillsConfig`, then runs `bunx skills add <repo> --skill <name> -g -a <agent> -y` for each skill/agent combination via Bun's shell `$` template.

**`setup/mcp.ts`** — thin MCP entry point. Receives loaded `activeMcpTargets` plus `mcpServers`, then delegates target-specific writes to focused submodules.

**`setup/mcp/core/`** — shared MCP internals:
- `env.ts` — env reference conversions like `${VAR}` → `${env:VAR}` / `$VAR` / `{env:VAR}` and runtime resolution for tools that need concrete values.
- `json.ts` — JSON / JSONC readers and JSONC parsing.
- `files.ts` — backup creation and parent-directory setup.
- `paths.ts` — global config path resolution per target.
- `converters.ts` — server-shape conversion for Antigravity, VS Code, Cursor, Windsurf, Gemini CLI, and Kilo.
- `codex.ts` — TOML rendering and managed-section updates for Codex.
- `server.ts` — shared server-shape helpers.

**`setup/mcp/targets/`** — one writer per MCP target:
- `claude-code.ts` — merges `mcpServers` into `~/.claude/settings.json`.
- `vscode.ts` — merges converted servers into `%APPDATA%/Code/User/mcp.json`.
- `antigravity.ts` — merges converted servers into `~/.gemini/antigravity/mcp_config.json`.
- `cursor.ts` — merges converted servers into `~/.cursor/mcp.json`.
- `windsurf.ts` — merges converted servers into `~/.codeium/windsurf/mcp_config.json`.
- `codex.ts` — writes managed `[mcp_servers.*]` entries into `~/.codex/config.toml`.
- `gemini-cli.ts` — merges converted servers into `~/.gemini/settings.json`.
- `kilo.ts` — merges converted servers into `~/.config/kilo/kilo.jsonc`.

Env var references still use `${VAR}` syntax in `config/mcp.config.ts`, and each target writer converts them to the format that agent expects. Examples: VS Code and Windsurf use `${env:VAR}`, Antigravity resolves `${VAR}` to concrete values while writing `mcp_config.json`, Gemini CLI uses `$VAR` in `env`, Codex uses `env_vars` / `env_http_headers`, and Kilo uses `{env:VAR}`. For Exa specifically, the HTTP server definition uses the `Authorization: Bearer ${EXA_API_KEY}` header shape.

### Config Layer (`config/`)

**`config/agents.config.ts`** — list of all supported agents with `enabled` boolean flags plus `mcpTargets`. The runtime loader derives `activeAgents` and `activeMcpTargets` from this array after loading either the default file or a user-provided override. Edit `enabled` here to include or exclude agents from all operations.

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

Current Exa example in this repo:

```ts
exa: {
  type: "http",
  url: "https://mcp.exa.ai/mcp",
  headers: { Authorization: "Bearer ${EXA_API_KEY}" },
  tools: ["web_search_exa", "web_fetch_exa"],
}
```

## Where Configs Are Written

| File | Written by | Contents |
|---|---|---|
| `~/.claude/settings.json` | `setupClaudeCodeMcp()` | `mcpServers` key merged in |
| `%APPDATA%/Code/User/mcp.json` | `setupVscodeMcp()` | `servers` key, VSCode format, global |
| `~/.gemini/antigravity/mcp_config.json` | `setupAntigravityMcp()` | `mcpServers` key merged in |
| `~/.cursor/mcp.json` | `setupCursorMcp()` | `mcpServers` key merged in |
| `~/.codeium/windsurf/mcp_config.json` | `setupWindsurfMcp()` | `mcpServers` key merged in |
| `~/.codex/config.toml` | `setupCodexMcp()` | managed `[mcp_servers.*]` sections |
| `~/.gemini/settings.json` | `setupGeminiCliMcp()` | `mcpServers` key merged in |
| `~/.config/kilo/kilo.jsonc` | `setupKiloMcp()` | `mcp` key merged in |

Skills are installed globally via the `bunx skills` CLI — they write to tool-specific global locations handled by that CLI.

## How to Extend

### Add an agent

In `config/agents.config.ts`, add to `agentsConfig`:
```ts
{ id: "new-agent-id", enabled: true, mcpTargets: ["cursor"] },
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
  args: ["-y", "package-name@version"],
  env: { API_KEY: "${MY_ENV_VAR}" },
},
```
Use `${VAR}` for any value that should be read from the system environment. The setup script handles format conversion automatically. For `npx`-based MCP servers, keep `-y` first so generated configs do not depend on interactive confirmation.

### Add a new target tool

To write MCP configs for a new tool (e.g., Cursor's `mcp.json`):
1. Add a target writer under `setup/mcp/targets/`
2. Add or reuse shared transforms in `setup/mcp/core/` if the target needs a new format
3. Export and register the new writer from `setup/mcp.ts`

## Runtime

The project uses Bun as both runtime and package manager. `index.ts` uses top-level `await` — Bun supports this natively. Shell commands use Bun's `$` template tag from `"bun"`.

Run the setup:
```bash
bun run index.ts          # installs skills + writes MCP configs for the active agents' targets
bun run index.ts --skills # installs only skills for the active agents
bun run index.ts --mcp    # writes only MCP configs for the active agents' targets
bun run index.ts --skills --project --agents-config ./my/agents.config.ts --skills-config ./my/skills.config.ts
bun run index.ts --mcp --agents-config ./my/agents.config.ts --mcp-config ./my/mcp.config.ts
bunx @evgenest/ai-agents-arsenal          # same flow via the published npm package
bunx @evgenest/ai-agents-arsenal --skills # published package, skills only
bunx @evgenest/ai-agents-arsenal --mcp    # published package, MCP only
```
