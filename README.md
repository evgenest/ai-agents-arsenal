# AI Agents Arsenal

A single-command setup that installs skills and MCP servers globally across all your AI coding agents — Claude Code, GitHub Copilot, Antigravity, Cursor, Windsurf, and more.

Run once on a new machine, get the same tools everywhere.

For the historical evolution of the project from version to version, see [CHANGELOG.md](./CHANGELOG.md).

## Prerequisites

- [Bun](https://bun.sh) — runtime and package manager

## Quick Start

### 1. Set API keys as system environment variables

| Variable | Service |
|---|---|
| `TAVILY_API_KEY` | [Tavily](https://tavily.com) |
| `CONTEXT7_API_KEY` | [Context7](https://context7.com) |
| `EXA_API_KEY` | [Exa](https://exa.ai) — sent to the Exa MCP endpoint as `Authorization: Bearer ${EXA_API_KEY}` |
| `MAGIC_API_KEY` | [21st.dev Magic](https://21st.dev) |

**Windows** — Win + R → `sysdm.cpl` → Advanced → Environment Variables → System variables

**macOS / Linux** — add to `~/.bashrc` or `~/.zshrc`:
```bash
export TAVILY_API_KEY=your_key_here
```

### 2. Install dependencies

```bash
bun install
```

### 3. Run

```bash
bun run index.ts
```

By default this runs both setup phases.

To run only one phase:

```bash
bun run index.ts --skills
bun run index.ts --mcp
```

To install skills into the current project instead of globally:

```bash
bun run index.ts --skills --project
```

`--project` only affects skill installation. MCP setup still writes to the configured global target files.

## What Gets Installed

### Skills

| Skill | Source repo |
|---|---|
| `better-icons` | better-auth/better-icons |
| `brainstorming` | obra/superpowers |
| `create-agentsmd`, `git-commit`, `prd` | github/awesome-copilot |
| `find-skills` | vercel-labs/skills |
| `frontend-design`, `skill-creator` | anthropics/skills |
| `next-best-practices` | vercel-labs/next-skills |
| `shadcn` | shadcn/ui |
| `vercel-composition-patterns`, `vercel-react-best-practices`, `web-design-guidelines` | vercel-labs/agent-skills |

### MCP Servers

| Server | Transport | Purpose |
|---|---|---|
| `tavily` | stdio | Web search |
| `context7` | stdio | Library documentation |
| `exa` | HTTP | Web search & fetch |
| `21st-magic` | stdio | UI component generation |

## Where Configs Are Written

| Target | File | Covers |
|---|---|---|
| Claude Code (global) | `~/.claude/settings.json` | Claude Code CLI + VS Code extension |
| VS Code / GitHub Copilot (global) | `%APPDATA%/Code/User/mcp.json` | All VS Code projects on this machine |
| Antigravity (global) | `~/.gemini/antigravity/mcp_config.json` | Google Antigravity across all projects |
| Cursor (global) | `%USERPROFILE%\.cursor\mcp.json` | Cursor across all projects |
| Windsurf (global) | `%USERPROFILE%\.codeium\windsurf\mcp_config.json` | Windsurf across all projects |
| Codex (global) | `~/.codex/config.toml` | Codex CLI + IDE extension |
| Gemini CLI (global) | `%USERPROFILE%\.gemini\settings.json` | Gemini CLI across all projects |
| Kilo (global) | `~/.config/kilo/kilo.jsonc` | Kilo across all projects |

## Configuration

### Enable / disable agents

Open [`config/agents.config.ts`](config/agents.config.ts) and toggle `enabled`:

```ts
{ id: "cursor",   enabled: true,  mcpTargets: ["cursor"] },    // turn on
{ id: "windsurf", enabled: false, mcpTargets: ["windsurf"] },  // turn off
```

Skills and MCP setup targets are driven by agents with `enabled: true`.

You can also choose which setup phase to run without changing agent config:
- `bun run index.ts` runs both skills and MCP setup
- `bun run index.ts --skills` runs only skill installation
- `bun run index.ts --mcp` runs only MCP config generation
- `bun run index.ts --skills --project` installs skills into the current project instead of using `-g`

Current MCP target mapping:
- `claude-code` writes to `~/.claude/settings.json`
- `github-copilot` writes to `%APPDATA%/Code/User/mcp.json`
- `antigravity` writes to `~/.gemini/antigravity/mcp_config.json`
- `cursor` writes to `%USERPROFILE%\.cursor\mcp.json`
- `windsurf` writes to `%USERPROFILE%\.codeium\windsurf\mcp_config.json`
- `codex` writes to `~/.codex/config.toml`
- `gemini-cli` writes to `%USERPROFILE%\.gemini\settings.json`
- `kilo` writes to `~/.config/kilo/kilo.jsonc`

Antigravity note: custom servers are written to `~/.gemini/antigravity/mcp_config.json` using Antigravity's own `mcpServers` format. Remote servers use `serverUrl`, and `${VAR}` placeholders from `config/mcp.config.ts` are resolved to concrete values at setup time because the public Antigravity docs document literal values, not config-level env interpolation.

### Add a skill

Open [`config/skills.config.ts`](config/skills.config.ts) and add an entry:

```ts
{
  repo: "owner/repo-name",
  skills: ["skill-name"],
},
```

### Add an MCP server

Open [`config/mcp.config.ts`](config/mcp.config.ts) and add an entry. Use `${VAR_NAME}` for environment variable references — the script auto-converts these to the correct syntax per tool.

**stdio server:**
```ts
"my-server": {
  command: "npx",
  args: ["-y", "my-mcp-package@latest"],
  env: { MY_API_KEY: "${MY_API_KEY}" },
},
```

For `npx`-based MCP servers, keep `"-y"` as the first argument so generated configs do not block on interactive install confirmation.

**HTTP server:**
```ts
"my-server": {
  type: "http",
  url: "https://mcp.example.com/mcp",
  headers: { "Authorization": "Bearer ${MY_API_KEY}" },
},
```

The built-in `exa` server follows this same pattern and sends `Authorization: Bearer ${EXA_API_KEY}`.

## Project Structure

```
index.ts                  # Entry point — orchestrates setup
setup/
  run.ts                  # Parses CLI flags and runs selected setup phases
  skills.ts               # Installs skills via bunx for active agents
  mcp.ts                  # Thin MCP orchestrator and public setup exports
  mcp/
    core/                 # Shared path/env/json/transform helpers
    targets/              # One writer per MCP target
config/
  agents.config.ts        # Agent list with enabled/disabled flags and MCP target mapping
  skills.config.ts        # Skills and their source repos
  mcp.config.ts           # MCP server definitions and env var references
```
