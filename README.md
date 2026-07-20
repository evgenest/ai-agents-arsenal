# AI Agents Arsenal

A single-command setup that installs skills and MCP servers for your AI coding agents — globally on your machine when needed, or directly inside a project when you want the repository itself to carry the skill setup.

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

### 2. Run the published package from any project

```bash
bunx @evgenest/ai-agents-arsenal
```

To install only skills into the current project:

```bash
bunx @evgenest/ai-agents-arsenal --skills --project
```

This keeps skill installation local to the project you run the command from. MCP setup still writes to the configured global agent config files.

### 3. Clone the repo if you want to customize the defaults

```bash
bun install
```

`bun install` also wires up a pre-commit hook automatically (via the `prepare` script — only runs for this repo's own root install, never for people who just `bunx`/install the published package). It blocks committing a `package.json` version bump without a matching `CHANGELOG.md` entry, and reminds you (without blocking) when `setup/`, `config/`, or `index.ts` change without a version bump — see [AGENTS.md](./AGENTS.md#release-flow) for the full release flow it supports.

Then run the local entrypoint:

```bash
bun run index.ts
```

By default both the published package and the local entrypoint run both setup phases.

To run only one phase:

```bash
bun run index.ts --skills
bun run index.ts --mcp
bunx @evgenest/ai-agents-arsenal --skills
bunx @evgenest/ai-agents-arsenal --mcp
```

To install skills into the current project instead of globally:

```bash
bun run index.ts --skills --project
bunx @evgenest/ai-agents-arsenal --skills --project
```

`--project` only affects skill installation. MCP setup still writes to the configured global target files.

To run with your own prepared config files instead of the package defaults:

```bash
bun run index.ts --skills --agents-config ./my-config/agents.config.ts --skills-config ./my-config/skills.config.ts
bun run index.ts --mcp --agents-config ./my-config/agents.config.ts --mcp-config ./my-config/mcp.config.ts
bunx @evgenest/ai-agents-arsenal --skills --project --agents-config ./ai/agents.config.ts --skills-config ./ai/skills.config.ts
```

If you do not pass custom config flags, the CLI prints a preflight summary before making changes. That preview shows which skills or MCP servers will be installed, which built-in config files are being used, links to the matching config files from the current package release, and the override flags you can use next time.

## Cloud Agent Use

Because the tool is published as an npm package, you can also use it to install skills directly into a repository instead of only configuring local machines.

Run:

```bash
bunx @evgenest/ai-agents-arsenal --skills --project
```

Then commit the generated project-local skill files to the repository. When a cloud agent such as GitHub Copilot or another repo-cloning agent starts from that repository, it gets the same checked-in skills as part of the clone and can use the project's skill setup immediately.

This repository-local pattern applies to skills. MCP configuration remains machine-specific and is still written to each target tool's global config location.

## What Gets Installed

### Skills

| Skill | Source repo |
|---|---|
| `better-icons` | better-auth/better-icons |
| `brainstorming`, `dispatching-parallel-agents`, `executing-plans`, `finishing-a-development-branch`, `receiving-code-review`, `requesting-code-review`, `subagent-driven-development`, `systematic-debugging`, `test-driven-development`, `using-superpowers`, `verification-before-completion`, `writing-plans`, `writing-skills` | obra/superpowers |
| `create-agentsmd`, `git-commit`, `prd` | github/awesome-copilot |
| `find-skills` | vercel-labs/skills |
| `frontend-design`, `skill-creator` | anthropics/skills |
| `next-best-practices` | vercel-labs/next-skills, pinned to [a commit](https://github.com/vercel-labs/next-skills/tree/dc1de9caf7612d73f56a8dec3cb1bd6c9ec096b9/skills/next-best-practices) — see below |
| `shadcn` | shadcn/ui |
| `vercel-composition-patterns`, `vercel-react-best-practices`, `web-design-guidelines` | vercel-labs/agent-skills |
| `agents-sdk`, `cloudflare-email-service`, `durable-objects`, `sandbox-sdk`, `turnstile-spin`, `web-perf`, `workers-best-practices`, `wrangler` | cloudflare/skills |
| `safe-release` | evgenest/safe-release |
| `ai-elements` | vercel/ai-elements |
| `ai-sdk`, `migrate-ai-sdk-v6-to-v7` | vercel/ai |
| `better-auth-best-practices`, `create-auth`, `email-and-password-best-practices`, `organization-best-practices`, `two-factor-authentication-best-practices` | better-auth/skills |
| `chat-sdk` | vercel/chat |
| `computer-use` | stablyai/orca |
| `context7-mcp` | upstash/context7 |
| `convex`, `convex-create-component`, `convex-migration-helper`, `convex-performance-audit`, `convex-quickstart`, `convex-setup-auth` | get-convex/agent-skills |
| `creative-director` | nexu-io/open-design |
| `dogfood` | nousresearch/hermes-agent |
| `email-best-practices` | resend/email-best-practices |
| `react-email` | resend/react-email |
| `resend-design-skills` | resend/design-skills |
| `note-taking` | seb1n/awesome-ai-agent-skills |
| `vercel-agent` | vercel-labs/vercel-plugin |
| `githits-mcp` | evgenest/claude-dotfiles |

Global skill files are installed via the [`skills`](https://www.npmjs.com/package/skills) npm package (`bunx skills add` / `bunx skills update`). `ai-agents-arsenal` treats Claude Code's own global skills directory (`~/.claude/skills/`, from the `claude-code` entry in [`config/agents.config.ts`](config/agents.config.ts)) as the canonical store, and never delegates agent-specific symlinking to the `skills` CLI's own `-a` targeting — instead:

- `setup/skills.ts` first lists already-installed global skills (`bunx skills list -g --json`). Skills already present are refreshed with `bunx skills update` (fast, no repo re-clone); only genuinely missing skills go through `bunx skills add ... -a claude-code`, which writes a skill's real files directly into `~/.claude/skills/<skill>` with no intermediate copy or extra symlink layer.
- It then creates every *other* active agent's symlink into that same directory, from the `skillsPath` declared per agent in `config/agents.config.ts`, and detects and repairs stale symlinks (broken, or pointing at an old target) on every run.

This is the actual reason `ai-agents-arsenal` exists as its own package instead of being a thin wrapper around `bunx skills add`:

1. **Reliable symlinking.** The `skills` CLI's own agent auto-detection is unreliable in non-interactive/CI environments — passed `-a` targets can silently produce no symlink at all if the CLI doesn't detect that agent as installed, and passing none installs to every one of its 70+ supported agents. Owning symlink creation avoids both failure modes and keeps every run fast once skills are already installed.
2. **One config, one command.** `skills add` only installs from a single repo per invocation. `config/skills.config.ts` lets you write down every skill you actually use, across as many source repos as you like, once — and install or update all of it with a single command instead of running `skills add` once per repository.
3. **Pinning a skill to a fixed commit.** Sometimes a skill disappears from a repo's default branch before its replacement ships (e.g. `next-best-practices` in `vercel-labs/next-skills`, being folded into Next.js core itself starting at v16.3.0 — not yet released). The `skills` CLI can't be pointed at an arbitrary commit to work around that for every repo: for fast-pathed owners like `vercel-labs` it fetches the packaged skill from Vercel's own hosted download API by slug — which ignores any ref you pass — and only falls back to `git clone --branch <ref>`, which only resolves real branch/tag names, never a raw SHA. `config/skills.config.ts` entries can set an optional `pin: { ref, path }` so that one entry bypasses `skills add` entirely and is fetched straight from that commit's GitHub tarball instead, then installed the same way as everything else.
4. **Fast, and kept fresh, via a global bun install of `skills` itself.** Every command here runs through `bunx skills ...`. When `skills` is already installed globally via bun (`bun add -g skills`), `bunx` resolves and runs it directly with no registry round-trip at all — verified by testing with the registry made deliberately unreachable, which still resolved instantly as long as a global install was present. Without one, every unpinned `bunx skills ...` call re-resolves against the registry from scratch, and this file makes several per run. (Vercel's own `skills` README only documents installing via `npx skills ...`, which is entirely reasonable — no single README can cover every package manager.) So `setup/skills.ts` runs one `bun add -g skills` / `bun update -g skills` at the start of every invocation: installs it globally the first time (so every later call, this run and future ones, skips the round-trip), then just keeps it current on every run after that — `bunx` never checks that on its own, so a global copy would otherwise go stale indefinitely. The update path deliberately skips `--latest`, so it only takes patch/minor releases within the already-accepted `^x.y.z` range and never jumps across a major version or onto an unvetted `latest` dist-tag release; a first-time install has no prior range to respect, so it takes whatever the registry's `latest` tag is, same as any other fresh install.

Project-scope installs (`--project`) have no shared canonical store to reuse across agents, so regular entries still delegate directly to the `skills` CLI's own per-agent `-a` targeting. Pinned entries can't reuse that either — a *local path* source (which a pinned commit's extracted tarball is) only reliably installs to the first `-a` target passed to a single `skills add` call in this CLI, so `setup/skills.ts` installs pinned skills to each active agent's project directory one `skills add` call at a time instead.

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
- `bun run index.ts --dry-run` prints the setup preview and exits without making changes
- `bun run index.ts --agents-config ./my-config/agents.config.ts --skills-config ./my-config/skills.config.ts` installs skills from custom config files
- `bun run index.ts --agents-config ./my-config/agents.config.ts --mcp-config ./my-config/mcp.config.ts` writes MCP config from custom config files

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

If you rely on the built-in MCP config, the CLI preview also reminds you which environment variables are referenced and whether any `npx`-based servers need `"-y"` as the first argument.

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
