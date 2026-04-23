# AI Agents Arsenal

A single-command setup that installs skills and MCP servers globally across all your AI coding agents — Claude Code, GitHub Copilot, Antigravity, Cursor, Windsurf, and more.

Run once on a new machine, get the same tools everywhere.

## Prerequisites

- [Bun](https://bun.sh) — runtime and package manager

## Quick Start

### 1. Set API keys as system environment variables

| Variable | Service |
|---|---|
| `TAVILY_API_KEY` | [Tavily](https://tavily.com) |
| `CONTEXT7_API_KEY` | [Context7](https://context7.com) |
| `EXA_API_KEY` | [Exa](https://exa.ai) |
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
# Install skills globally + write MCP servers to ~/.claude/settings.json
bun run index.ts

# Also generate .vscode/mcp.json for GitHub Copilot Chat in a project
cd /path/to/your/project && bun run /path/to/ai-agents-arsenal/index.ts --vscode
```

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
| Claude Code (global) | `~/.claude/settings.json` | Claude Code CLI + VSCode extension |
| GitHub Copilot Chat | `.vscode/mcp.json` in project | VSCode workspace (requires `--vscode` flag) |

## Configuration

### Enable / disable agents

Open [`config/agents.config.ts`](config/agents.config.ts) and toggle `enabled`:

```ts
{ id: "cursor",   enabled: true  },  // turn on
{ id: "windsurf", enabled: false },  // turn off
```

Skills will be installed only for agents with `enabled: true`.

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
  args: ["my-mcp-package@latest"],
  env: { MY_API_KEY: "${MY_API_KEY}" },
},
```

**HTTP server:**
```ts
"my-server": {
  type: "http",
  url: "https://mcp.example.com/mcp",
  headers: { "Authorization": "Bearer ${MY_API_KEY}" },
},
```

## Project Structure

```
index.ts                  # Entry point — orchestrates setup
setup/
  skills.ts               # Installs skills via bunx for active agents
  mcp.ts                  # Writes MCP configs for Claude Code and VSCode
config/
  agents.config.ts        # Agent list with enabled/disabled flags
  skills.config.ts        # Skills and their source repos
  mcp.config.ts           # MCP server definitions and env var references
```
