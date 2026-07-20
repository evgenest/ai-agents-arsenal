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

`bun install` in a clone of this repo also runs `git config core.hooksPath .githooks` automatically via the `prepare` script in `package.json` — no separate setup step needed. This wires up `.githooks/pre-commit` (a `bun` script, no extra dependency), which blocks any commit that changes `package.json`'s `version` without also staging a `CHANGELOG.md` update, and prints a non-blocking reminder when `setup/`, `config/`, or `index.ts` change without a version bump — to catch the "forgot to bump the version and write the changelog entry" case this Release Flow section depends on.

`prepare` only runs for the package's own root install (a fresh clone, `bun install` with no args) or before publish — verified it does *not* run when `@evgenest/ai-agents-arsenal` is installed as a dependency or resolved via `bunx`, so it has no effect on end users of the published package. `core.hooksPath` itself is a local git config setting, not tracked by git, so each individual clone still needs its own `bun install` to pick it up — it just no longer requires a manual command.

### For each new release

If you're using Claude Code, running `/release` in this repo drives all of the steps below in one go (version bump, `README.md`/`AGENTS.md`/`CHANGELOG.md` updates, typecheck/test, commit, push, and the `gh release create --prerelease` call) — see `.claude/commands/release.md`. The manual steps:

1. Update `package.json` and `CHANGELOG.md` to the new version.
2. Commit and push the version bump to `main`.
3. Create a GitHub Release with the `--prerelease` flag — the tag must match the package version:

```bash
gh release create v<VERSION> --prerelease --title "v<VERSION> (beta)" --notes "..."
```

The CI pipeline then runs automatically in two stages:

- **`verify`** — always runs. Checks out the tag, verifies `package.json` version matches the tag, runs `bun test` and `bun run typecheck`.
- **`promote-and-publish`** — runs after `verify` passes, only when the release is a pre-release. Publishes to npm first, then strips the beta note from the release body and promotes the release to stable in one job. Promote and publish are combined because GitHub's `GITHUB_TOKEN` cannot trigger further workflow runs, so relying on a second `released` event would silently skip the npm publish.

You do not need to manually promote the release or run `npm publish` locally. If `verify` fails, the release stays as a pre-release and nothing is published.

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

**`setup/run.ts`** — exports `runSetup()`. Parses CLI flags and chooses which setup phases to run. Supported flags: `--skills`, `--mcp`, `--project`, `--dry-run`, `--agents-config`, `--skills-config`, `--mcp-config`, and `--help`. With no phase flags, it runs both skills and MCP setup. Before applying changes it prints a phase-specific preview of the loaded setup; `--dry-run` stops right after that preview and skips `setupSkills`/`setupMcp` entirely.

**`setup/config.ts`** — runtime config loader. Resolves default versus user-provided config paths, imports config modules dynamically, validates their exports, and derives `activeAgents` plus `activeMcpTargets` from the loaded agent config.

**`setup/preflight.ts`** — renders the setup preview shown before installation. Prints phase-specific details for skills and MCP along with config source info, environment variable references, and override flag hints.

**`setup/skills.ts`** — exports `setupSkills()`. Receives `agentsConfig`, `skillsConfig`, and a scope (`"global"` default, or `"project"` from `--project`).

Before anything else, `ensureGlobalSkillsCliFresh()` runs once per invocation. It checks whether `skills` is already a global bun package (`bun pm bin -g` → `.../install/global/node_modules/skills/package.json`): if not, `bun add -g skills` installs it (one-time, so every later `bunx skills ...` call — this run and future ones — resolves instantly instead of re-hitting the registry); if it's already there, `bun update -g skills` keeps it current (deliberately no `--latest`, so it stays within the already-accepted `^x.y.z` range — patch/minor only, never a major bump or an unvetted `latest` dist-tag release). This exists because `bunx skills ...` resolves an already-globally-installed package with zero registry round-trip, but never installs or updates it on its own, and this file makes several `bunx skills` calls per run.

**Global scope** (`setupGlobalSkills`) never passes our active agents to the `skills` CLI's own `-a` flag — the CLI's per-agent targeting is unreliable non-interactively (see README §"What Gets Installed → Skills" for specifics). Instead:
- `bunx skills list -g --json` lists what's already installed. Already-present skills are refreshed with one batched `bunx skills update <names> -g -y`; missing ones go through `bunx skills add <repo> --skill <name> -g -a claude-code -y` — passing only `claude-code` makes the CLI write the skill's real files directly into `~/.claude/skills/<skill>` (the `claude-code` entry's `skillsPath` in `agents.config.ts`), which this codebase treats as the canonical store.
- Entries with `pin` (see below) skip `bunx skills add` entirely: `fetchPinnedSkill()` downloads `https://codeload.github.com/<repo>/tar.gz/<ref>` and extracts it to a temp dir; `installPinnedSkill()` copies the result straight into the canonical store. Idempotency is a plain `stat()` on the target dir — pins are immutable, so no network call once present.
- `createSkillSymlinks()` then symlinks every *other* active agent's `skillsPath` to the canonical store itself (self-managed, not delegated to the CLI), repairing stale/broken symlinks on every run.

**Project scope** (`setupProjectSkills`) has no shared canonical store to reuse across agents. Regular entries still delegate to `bunx skills add <repo> --skill <name> -a agent1 -a agent2 ... -y` in one call. Pinned entries can't use that shortcut: for a *local path* source (which a pinned commit's extracted tarball is), this build of the `skills` CLI only reliably symlinks the first `-a` target in a multi-agent call and silently drops the rest — reproduced by hand, not documented CLI behavior. `installPinnedSkillToProject()` works around it by calling `bunx skills add <localDir> --skill <name> -a <agent> -y` once per active agent instead.

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

**`config/agents.config.ts`** — list of all supported agents with `enabled` boolean flags, `mcpTargets`, and `skillsPath` (each agent's global skills directory). The runtime loader derives `activeAgents` and `activeMcpTargets` from this array after loading either the default file or a user-provided override. Edit `enabled` here to include or exclude agents from all operations.

Every entry carries `skillsPath`, sourced from the `skills` npm package's own Supported Agents table (`vercel-labs/skills` README) — including agents currently `enabled: false`, so flipping one on doesn't require looking up its path. `setup/skills.ts` owns symlinking into these paths itself rather than the `skills` CLI (`claude-code`'s path doubles as the canonical store — see below).

Supported agent IDs: `claude-code`, `github-copilot`, `antigravity`, `antigravity-cli`, `cursor`, `windsurf`, `codex`, `gemini-cli`, `kilo`. Note: `antigravity` and `antigravity-cli` are distinct agents with different global skill paths (`~/.gemini/antigravity/skills/` and `~/.gemini/antigravity-cli/skills/` respectively).

**`config/skills.config.ts`** — array of `{ repo, skills[], pin? }` objects. Each entry maps a GitHub repo to one or more skill names, installed via the `bunx skills` CLI. An entry may instead carry `pin: { ref, path }` — a commit SHA and the skill's path within the repo at that commit — for a skill the `skills` CLI can't reach at the ref you need (e.g. it vanished from the repo's default branch). An entry with `pin` must declare exactly one skill; see `setup/skills.ts` for why `bunx skills add` can't do this itself and how the fetch works instead.

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

Skills are installed via the `bunx skills` CLI, but this codebase — not the CLI — decides where each agent's copy ends up. Global installs land as real files at `claude-code`'s `skillsPath` (`~/.claude/skills/<skill>` by default); every other active agent gets a symlink into that directory, created and repaired by `setup/skills.ts` on each run. Project-scope installs (`--project`) do delegate per-agent placement to the CLI's own `-a` targeting, except for pinned skills, which are still installed one agent at a time (see `setup/skills.ts`).

## How to Extend

### Add an agent

In `config/agents.config.ts`, add to `agentsConfig`, including `skillsPath` (its global skills directory — look it up in the Supported Agents table in the `skills` npm package's own README, don't guess):
```ts
{ id: "new-agent-id", enabled: true, mcpTargets: ["cursor"], skillsPath: "~/.new-agent/skills" },
```
The `as const` on the array means the `id` values are typed as string literals. Adding a new entry is safe.

### Add a skill

In `config/skills.config.ts`, add or extend an entry:
```ts
{ repo: "owner/repo", skills: ["skill-name"] },
```

### Pin a skill to a fixed commit

Only when the `skills` CLI genuinely can't reach the skill at the ref you need (see `setup/skills.ts`'s `fetchPinnedSkill` for why that can happen). The entry must declare exactly one skill:
```ts
{
  repo: "owner/repo",
  skills: ["skill-name"],
  pin: { ref: "<commit-sha>", path: "path/to/skill-name" },
},
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
