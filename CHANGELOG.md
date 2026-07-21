# Changelog

This changelog documents the main historical release milestones of the project.

The entries below were created retroactively from the git history and Claude Code session history to capture what changed from version to version, not just to restate release summaries.

## v6.1.1 - Claude Code rejected the `tools` field on MCP servers

Release date: 2026-07-21

Tag: `v6.1.1`

Changes since `v6.1.0`:
- `setup/mcp/core/converters.ts`: adds `convertServerForClaudeCode()`. The `claude-code` target had no converter — it wrote each `McpServer` into `~/.claude.json` unconverted, including the `tools` array. Claude Code's own `mcpServers` schema has no `tools` field and rejects the whole server entry if it's present (confirmed live: `claude mcp list` skipped the `exa` server with "invalid MCP server config for \"exa\": tools.0: expected object, received string"). `tools` is a VS Code/GitHub Copilot `mcp.json` concept, also rendered as `enabled_tools` for Codex — never a Claude Code one. The new converter strips `tools` and otherwise passes the server through unchanged, leaving `${VAR}` references as-is since Claude Code expands those itself
- `setup/mcp/targets/json-merge.ts`: registers `convertServerForClaudeCode` as the `claude-code` target's converter
- `AGENTS.md`: corrects the `tools` field docs (previously mislabeled "VSCode-specific" without explaining it breaks Claude Code) and notes that restricting which tools an MCP server exposes in Claude Code is done via `mcp__<server>__<tool>` entries in `permissions.allow` (settings.json), not the server config

Net effect:
- running this tool's Claude Code MCP setup with any server that declares `tools` (e.g. the built-in `exa` entry) no longer breaks that server in Claude Code — it now loads correctly instead of being skipped with a validation error

## v6.1.0 - Real Claude Code MCP path, and one shared writer for JSON-merge targets

Release date: 2026-07-21

Tag: `v6.1.0`

Changes since `v6.0.0`:
- `setup/mcp/targets/claude-code.ts` was writing `mcpServers` into `~/.claude/settings.json`, which Claude Code never reads for MCP servers — that file is for permissions/hooks/env only. Per Claude Code's own docs (https://code.claude.com/docs/en/mcp), MCP servers live in `~/.claude.json`, at one of three scopes: local (nested under the current project's path), project (`.mcp.json` at a repo root, shared via git), or user (top-level `mcpServers` key, all projects). This project now writes user scope — `~/.claude.json`'s top-level `mcpServers` key — matching every other target here, which are all global/all-projects configs
- `setup/mcp/core/paths.ts`: `getClaudeCodeSettingsPath()` → `getClaudeCodeMcpPath()`, now resolving to `~/.claude.json`. `setupClaudeCodeMcp()` only ever touches the top-level `mcpServers` key — the rest of `~/.claude.json` (OAuth account info, per-project state, caches) is read back and rewritten unchanged; merge behavior was verified against a copy of the file, not the live one, since it's actively used by the running session
- `setup/mcp/targets/vscode.ts`: its backup-log line didn't name the product ("Existing mcp.json backed up..."), unlike every other target — now reads "Existing VS Code MCP config backed up..."
- consolidates six near-identical target-writer files (`claude-code.ts`, `vscode.ts`, `antigravity.ts`, `cursor.ts`, `windsurf.ts`, `kilo.ts` — each read an existing JSON/JSONC file, merged converted servers into one top-level key, and wrote it back, differing only in path/key/converter/format/wording) into one new `setup/mcp/targets/json-merge.ts`: a `jsonMergeTargets` registry (keyed by `McpTarget`) holding each target's path getter, merge key, optional converter, JSON-vs-JSONC format, and trailing-newline flag, plus one `setupJsonMergeTarget()` writer shared by all of them. `setup/mcp/targets/codex.ts` (TOML, not a JSON merge) is untouched and still registered directly in `setup/mcp.ts`. On-disk behavior for every target was verified byte-for-byte identical against the pre-refactor files (backup/write log wording, merged keys, converter output, trailing newline) using a throwaway `$HOME` seeded with fixture config files
- `AGENTS.md`: `setup/mcp/targets/` file listing, "Where Configs Are Written" table, and "Add a new target tool" instructions updated to describe the registry-based structure

Net effect:
- Claude Code MCP setup via this tool actually works now — previously every run silently wrote to a file Claude Code never reads for MCP, so configured servers never showed up in `claude mcp list`
- adding a JSON-merge-shaped MCP target going forward is a one-entry addition to `jsonMergeTargets`, not a new file to keep in sync by hand — the exact kind of drift that caused the `vscode.ts` wording gap above and the Antigravity path bug fixed in v6.0.0

## v6.0.0 - Antigravity CLI target, real MCP config path, and Gemini CLI removal

Release date: 2026-07-21

Tag: `v6.0.0`

Changes since `v5.2.1`:
- `setup/mcp/core/paths.ts`: fixes `getAntigravityMcpPath()` — it was pointing at `~/.gemini/antigravity/mcp_config.json`, a path Antigravity CLI never reads; the real path, confirmed against both a live install and Google's own docs (https://antigravity.google/docs/mcp), is `~/.gemini/config/mcp_config.json`, shared by Antigravity IDE and CLI
- `config/agents.config.ts`: splits the single `"antigravity"` `McpTarget` into `"antigravity"` (IDE) and `"antigravity-cli"` (CLI) — both still resolve to the same shared config file, but the `antigravity-cli` agent entry's `mcpTargets` now correctly says `antigravity-cli` instead of the generic `antigravity`, so target names in every log/preview line match the actual product
- `setup/mcp/targets/antigravity.ts`: `setupAntigravityMcp()` (IDE) and new `setupAntigravityCliMcp()` (CLI) are now thin wrappers over one shared writer that only differ in the console-log label ("Antigravity" vs "Antigravity CLI"), matching the wording every other target's writer already used
- removes the `gemini-cli` MCP target entirely (breaking for any custom `agents.config.ts` still referencing it — it now throws "Unsupported MCP target"): deletes `setup/mcp/targets/gemini-cli.ts`, `convertServerForGemini()` and `toGeminiEnvFormat()`, `getGeminiSettingsPath()`, and the `SUPPORTED_MCP_TARGETS`/`McpTarget` entries
- `setup/preflight.ts` (new): `getMissingMcpEnvVars()` checks which `${VAR}` references in `config/mcp.config.ts` aren't set in the current shell — by name only, values are never read or logged — and `printMissingMcpEnvVarsSummary()` prints a boxed warning at the end of the run (not just in the early preview, so it survives scrolling terminal output from npx installs etc.). When Antigravity is among the active targets, the box also names the file to hand-edit (`~/.gemini/config/mcp_config.json`) and the exact JSON path for each missing var (e.g. `mcpServers.exa.headers.Authorization`), since Antigravity bakes literal values into its config with no `${VAR}` substitution of its own
- `setup/run.ts`: calls the new summary after `setupMcp()` (and before the dry-run early return) instead of leaving missing env vars silently undiscovered until a server fails to start
- `setup/preflight.test.ts` (new): covers `getMissingMcpEnvVars()` against a set/unset env var
- `README.md` / `AGENTS.md`: "Where Configs Are Written" tables and target-mapping lists updated to the real Antigravity path and the IDE/CLI split; all Gemini CLI references removed

Net effect:
- Antigravity CLI MCP setup actually works now — previously every run silently wrote to a file the CLI never looked at, so configured servers never showed up
- a run with unset API keys now ends with a single, hard-to-miss summary instead of requiring the user to notice a missing-var problem only when a server fails to start, or to scroll back to the very top of a long run's output
- any project depending on the `gemini-cli` MCP target needs to switch to a different target or drop that entry before upgrading

## v5.2.1 - `/release` waits for CI and reports the real outcome

Release date: 2026-07-20

Tag: `v5.2.1`

Changes since `v5.2.0`:
- `.claude/commands/release.md`: after `gh release create --prerelease`, the command now records the previous `publish-npm.yml` run id, polls for the new run tied to this release, and blocks on `gh run watch --exit-status` instead of just telling the user "CI will handle it"
- adds an explicit reporting step: on success, confirms via `gh release view --json isPrerelease` that the release actually flipped to stable before telling the user it's done; on failure (or if no run ever appears), surfaces the failing job/step and log tail instead of reporting the release as complete
- `AGENTS.md` / `README.md`: updated the `/release` description to mention it waits for CI and reports the real result, not just that it "kicks off" the pre-release

Net effect:
- previously `/release` could report "done" right after `gh release create`, even though CI (tests, typecheck, npm publish) hadn't run yet and could still fail — now the command's own final status reflects whether the release actually went out, not just whether the pre-release object was created

## v5.2.0 - `/release` slash command for the release flow

Release date: 2026-07-20

Tag: `v5.2.0`

Changes since `v5.1.0`:
- adds `.claude/commands/release.md`, a project-local Claude Code slash command that drives the full Release Flow (version bump, `CHANGELOG.md` entry, README/AGENTS doc updates, `bun test`/`bun run typecheck`, commit, push, and `gh release create --prerelease`) from a single `/release` invocation instead of the manual steps in `AGENTS.md` → Release Flow
- `AGENTS.md` and `README.md`: document `/release` next to the existing manual Release Flow steps it automates
- `config/skills.config.ts` / `README.md`: drop the `evgenest/claude-dotfiles` repo entry (private personal dotfiles repo, not a usable public source for the `githits-mcp` skill mapping)

Net effect:
- cutting a release from Claude Code is now one command instead of a multi-step manual sequence, reducing the chance of a step (doc update, CHANGELOG entry, or the pre-release call itself) being skipped
- the skills table no longer references a private repo that other users of this project can't actually clone

## v5.1.0 - Dry-run flag, and config catch-up with what's actually installed

Release date: 2026-07-20

Tag: `v5.1.0`

Changes since `v5.0.1`:
- adds a `--dry-run` flag to `setup/run.ts`: prints the usual `printSetupPreview` output, then returns before `setupSkills`/`setupMcp` are called, so nothing is written — previously the preview was informational only and every run applied changes unconditionally
- expands `config/skills.config.ts` from 10 to 25 repo entries (15 skills to 61 skills): most of the added skills were already present on disk (installed at some point outside this config, per `~/.agents/.skill-lock.json` provenance), so this brings the config back in sync with reality rather than installing anything new — notably extends the existing `obra/superpowers` entry with 12 more skills and `cloudflare/skills` with 6 more
- trims `config/agents.config.ts` down to the agents actually in use: removes the disabled entries for `gemini-cli`, `github-copilot`, `antigravity`, `windsurf`, `codex`, and `kilo`; re-adds `hermes-agent` (kept `enabled: false`) and adds `cursor` (`enabled: true`, `~/.cursor/skills`)
- updates the README `What Gets Installed → Skills` table and the `--dry-run` flag docs in both README.md and AGENTS.md to match

Net effect:
- a plain `bun run index.ts --dry-run` now gives a true no-op preview, closing the gap between "shows a preview" and "asks for confirmation before acting" that the preview text implied but the code never enforced
- `config/skills.config.ts` is now the actual source of truth for every skill this machine has installed through `ai-agents-arsenal`, instead of describing a subset of it

## v5.0.1 - Pre-commit reminder for the release step

Release date: 2026-07-20

Tag: `v5.0.1`

Changes since `v5.0.0`:
- extends `.githooks/pre-commit` so a version bump that passes the existing CHANGELOG check now also prints a non-blocking reminder of the remaining Release Flow step — push to `main`, then `gh release create v<version> --prerelease --title "v<version> (beta)" --notes "..."` — so CI picks up the pre-release and publishes it to npm

Net effect:
- the pre-commit hook already caught "bumped the version but forgot the CHANGELOG"; it now also nudges toward the next step so a version bump doesn't get committed and pushed without a matching GitHub pre-release ever being created

## v5.0.0 - Own global skill installation, commit pinning, and CLI freshness

Release date: 2026-07-20

Tag: `v5.0.0`

Changes since `v4.5.0`:
- reworks global skill installation to stop delegating agent targeting (`-a`) to the upstream `skills` CLI: `claude-code`'s real files at `~/.claude/skills/<skill>` are now the single canonical store, and symlinks for every other active agent are created and repaired by ai-agents-arsenal itself
- adds `skillsPath` to every entry in `config/agents.config.ts`, including previously disabled agents (`github-copilot`, `cursor`, `windsurf`, `codex`, `kilo`), so enabling skill installation for them is a one-line config change
- speeds up repeat global installs by checking what's already installed via `skills list -g --json` and updating those in one batched `skills update` call instead of re-cloning every repo through `skills add` (~18s → ~2s across the full 15-skill set in testing)
- adds a `pin: { ref, path }` option to `SkillsConfigEntry` so a single skill can be locked to an exact commit SHA, for cases where the upstream `skills add` can't resolve the needed version (e.g. `vercel-labs/next-skills`, which prefers a packaged slug lookup over the passed ref and only falls back to `git clone --branch`, which doesn't accept a bare SHA); pinned skills are fetched as a GitHub commit tarball instead
- adds `ensureGlobalSkillsCliFresh()`, run once at the start of every setup: installs the `skills` CLI globally via `bun add -g skills` if it's missing, or updates it via `bun update -g skills` (without `--latest`, so it stays within the semver range accepted at first install) if it's already present — avoids every `bunx skills` call in a run silently resolving against a stale globally-cached version
- adds graceful failure handling for skill installation: failures are collected and printed as a clean summary instead of surfacing raw CLI output, with improved parsing of the `skills` CLI's stderr/stdout (Buffer decoding, ASCII logo stripped, duplicate output merged, multiple failures separated by a divider)
- adds a `.githooks/pre-commit` hook (plain `bun` script, no Husky) that blocks a commit if `package.json`'s `version` changes without a matching staged `CHANGELOG.md` update, and prints a non-blocking reminder when `setup/`, `config/`, or `index.ts` change without a version bump
- adds a `prepare` script (`git config core.hooksPath .githooks 2>/dev/null || true`) so `bun install` wires up the pre-commit hook automatically for anyone cloning the repo, instead of requiring a manual one-time command; the `|| true` keeps `bun install` from failing outside a git checkout, and the hook has no effect on consumers who install the published package or run it via `bunx`
- upgrades `typescript` from `^5` to `^7`, the actual next major (the native Go-based compiler; `6.0.0-beta` was abandoned in favor of a direct jump to 7) — `tsc --noEmit` dropped from 1.77s to 0.29s on this project with no code or `tsconfig.json` changes needed
- combines the CI `promote-and-publish` job further and removes the now-dead standalone `publish` fallback job, since releases are always created as pre-releases
- removes `.claude/settings.local.json` from git tracking and adds it to `.gitignore` (it holds personal, non-shared permission overrides that had been committed by mistake)
- expands the `package.json` description to mention skill updates and commit pinning, not just installation

Net effect:
- global skill installation no longer depends on the upstream `skills` CLI's own agent-detection or symlinking behavior, which was unreliable in non-interactive/CI environments — ai-agents-arsenal now fully owns which agents get which skills
- a skill can be pinned to a fixed commit when its upstream default branch temporarily stops providing a working copy, without blocking or erroring the rest of the install
- repeat global installs are meaningfully faster, and the `skills` CLI itself no longer silently goes stale between runs
- a version bump without a corresponding `CHANGELOG.md` entry is now caught locally at commit time instead of surfacing at release time
- `bun run typecheck` is roughly 6x faster locally and in CI

## v4.5.0 - Cloudflare skills, safe-release, and automated CI promotion

Release date: 2026-05-20

Tag: `v4.5.0`

Changes since `v4.4.0`:
- adds `web-perf` and `wrangler` from `cloudflare/skills` to the skills config
- adds `safe-release` from `evgenest/safe-release` to the skills config
- updates README skills table to reflect the three new entries
- replaces the single publish job with two jobs: `verify` (always runs) and `promote-and-publish` (pre-release only — publishes to npm then promotes to stable in one step)
- combines promotion and npm publish into a single job to work around GitHub's recursive-trigger protection — `GITHUB_TOKEN` cannot fire a new workflow run, so relying on a second `released` event after auto-promotion would silently skip the npm publish
- updates AGENTS.md release flow to document the fully automated pipeline

Net effect:
- the default install now includes Cloudflare Wrangler CLI guidance and web performance auditing out of the box
- the safe GitHub release workflow is part of the standard skill set
- releasing requires only `gh release create --prerelease`; CI handles verification, npm publish, and promotion to stable without any manual steps

## v4.4.0 - Custom config inputs and setup preview

Release date: 2026-04-26

Tag: `v4.4.0`

Changes since `v4.3.4`:
- adds `--agents-config`, `--skills-config`, and `--mcp-config` so the CLI can load prepared custom config files instead of only using the built-in defaults
- moves setup config loading to runtime, validates custom config exports, and threads loaded agent, skills, and MCP data through the setup pipeline instead of relying on static imports
- prints a phase-specific preflight preview before making changes so users can see the skills or MCP servers that will be installed, the environment variables involved, and the matching default config files from the current package release
- updates the npm publish workflow to also react to the `release: released` event so promoting a verified pre-release to stable triggers the publish job
- updates README and AGENTS documentation to cover the new config override flow and preview behavior

Net effect:
- users can prepare multiple config variants ahead of time and choose one at execution time without editing the package source
- the default install path is more transparent because the CLI now explains what it is about to install and how to override it
- staged GitHub releases can now be safely promoted from pre-release to stable without losing the npm publish automation

## v4.3.4 - GitHub Actions runtime refresh

Release date: 2026-04-26

Tag: `v4.3.4`

Changes since `v4.3.3`:
- updates the npm publish workflow from `actions/checkout@v4` to `actions/checkout@v6`
- updates the npm publish workflow from `actions/setup-node@v4` to `actions/setup-node@v6`

Net effect:
- the release workflow is aligned with the current major versions of the core GitHub actions it depends on
- the repository is prepared for GitHub's Node 20 action runtime deprecation without changing the Trusted Publishing flow

## v4.3.3 - Trusted Publishing runner compatibility fix

Release date: 2026-04-26

Tag: `v4.3.3`

Changes since `v4.3.2`:
- replaces the in-workflow `npm install -g npm@latest` step with a direct Node LTS setup that provides a compatible npm for Trusted Publishing
- keeps the OIDC-based publish flow and provenance emission intact while removing the failing self-upgrade path on the GitHub runner
- clarifies in the docs that the published npm package can install project-local skills which can be committed for cloud agents that clone the repository

Net effect:
- the Trusted Publishing release job no longer depends on mutating the runner's preinstalled npm before publish
- the next release can validate the OIDC publish path without the `MODULE_NOT_FOUND` failure seen in `v4.3.2`
- the README now documents the repository-local skills workflow for cloud agents in addition to local machine setup

## v4.3.2 - Trusted Publishing for npm releases

Release date: 2026-04-26

Tag: `v4.3.2`

Changes since `v4.3.1`:
- migrates the npm publish workflow from a long-lived `NPM_TOKEN` secret to npm Trusted Publishing via GitHub Actions OIDC
- updates the publish workflow permissions and npm invocation so release publishes can mint an id-token and emit provenance
- rewrites the documented release setup to use npm Trusted Publisher package settings instead of a repository secret

Net effect:
- future GitHub release publishes no longer depend on a stored npm token in the repository
- npm release automation matches npm's current recommended CI publishing model and is ready to validate on the next tag

## v4.3.1 - Release automation and publish manifest fix

Release date: 2026-04-26

Tag: `v4.3.1`

Changes since `v4.3.0`:
- normalizes the npm `bin` entry to the form npm expects, which removes the publish-time auto-correction warning for the package CLI
- adds a GitHub Actions workflow that publishes the package to npm when a matching GitHub Release is published
- documents the release flow so version bumps, GitHub releases, and npm publication stay aligned

Net effect:
- future npm releases can be driven from GitHub instead of running `npm publish` manually from a local terminal
- the package manifest now passes dry-run packaging without the previous `bin` warning

## v4.3.0 - npm package publication readiness

Release date: 2026-04-26

Tag: `v4.3.0`

Changes since `v4.2.0`:
- makes the repository publishable as the public npm package `@evgenest/ai-agents-arsenal`
- adds npm package metadata and a CLI bin entry so the setup can be executed with `bunx @evgenest/ai-agents-arsenal`
- adds focused CLI argument parsing tests and updates the help/docs to cover the published-package workflow

Net effect:
- the same setup flow can now be distributed through npm instead of requiring a repo clone first
- project-local skill installation remains available through `--skills --project`, including when the tool is run via `bunx`

## v4.2.0 - Project-local skill installation

Release date: 2026-04-26

Tag: `v4.2.0`

Changes since `v4.1.1`:
- adds a `--project` CLI flag so skills can be installed into the current project instead of always using global installation
- keeps the default setup behavior unchanged, so existing commands still install skills globally unless `--project` is passed
- updates README usage examples and configuration notes to document the new installation scope option

Net effect:
- the setup flow now supports both machine-wide skill bootstrapping and repository-local skill installation without introducing a separate command
- MCP setup behavior remains global and unchanged, so the new scope flag only affects the skill installation phase

## v4.1.1 - npx MCP prompt suppression

Release date: 2026-04-23

Tag: `v4.1.1`

Changes since `v4.1.0`:
- adds `-y` as the first argument for the built-in `npx`-based MCP servers so generated configs do not depend on interactive install confirmation
- updates README and AGENTS examples to document the same `npx -y` convention for future MCP server additions

Net effect:
- generated stdio MCP configs are more reliable in non-interactive runtimes such as Antigravity
- the change is intentionally narrow and does not alter the supported server list or transport shapes

## v4.1.0 - Selective setup execution and Exa auth fix

Release date: 2026-04-23

Tag: `v4.1.0`

Changes since `v4.0.0`:
- adds CLI phase selection so `bun run index.ts --skills` and `bun run index.ts --mcp` can run setup independently while the default command still runs both phases
- makes plain JSON config reads tolerate empty files, which avoids setup failures on blank existing configs such as Antigravity's `mcp_config.json`
- switches the Exa remote MCP server definition from `x-api-key` to the documented `Authorization: Bearer ...` header format
- updates repository documentation so the new setup flow and Exa auth format are described consistently

Net effect:
- repeated setup runs no longer have to reinstall skills when only MCP output needs to be refreshed
- the generated Exa MCP configuration now matches Exa's documented remote auth contract

## v4.0.0 - Dedicated Antigravity target

Release date: 2026-04-23

Tag: `v4.0.0`

Commit: `06e059a`

Changes since `v3.0.0`:
- replaces the provisional Antigravity mapping with a dedicated Antigravity MCP target
- adds explicit Antigravity path resolution and target-specific conversion logic
- completes the transition from "Antigravity is listed" to "Antigravity has its own supported write path"

Net effect:
- `v3.0.0` could describe Antigravity as part of the system, but not as a properly supported target
- `v4.0.0` is the first version where Antigravity support stands on the same conceptual footing as the other dedicated MCP targets

## v3.0.0 - Multi-agent global MCP targets

Release date: 2026-04-23

Tag: `v3.0.0`

Commit: `f1f99cd`

Changes since `v2.0.0`:
- expands MCP output from a minimal Claude Code and VS Code setup to a broader multi-agent, multi-target system
- adds global MCP targets for Cursor, Windsurf, Codex, Gemini CLI, and Kilo
- ties MCP target selection to enabled agents instead of treating setup as a mostly fixed flow
- pushes the project further into a config-driven toolchain rather than a small single-purpose script

Antigravity status in this version:
- Antigravity exists only as a provisional mapping
- there is still no dedicated, verified Antigravity target yet

Net effect:
- `v2.0.0` is the smallest usable MCP-enabled setup
- `v3.0.0` is the first version that clearly behaves like an arsenal for multiple agents, but still stops short of full Antigravity support

## v2.0.0 - Minimal MCP support

Release date: 2026-04-23

Tag: `v2.0.0`

Commit: `6bad1d5`

Changes since `v1.0.0`:
- introduces MCP servers into a project that previously handled only skill installation
- adds repository-level MCP server definitions as a first-class part of the setup
- starts persisting MCP configuration into Claude Code settings
- extends the flow toward VS Code MCP configuration instead of stopping at skills only

Net effect:
- `v1.0.0` installs capabilities through skills alone
- `v2.0.0` becomes the first real hybrid version: skills plus MCP, while still keeping the system relatively small and easy to trace

## v1.0.0 - Skills-only foundation

Release date: 2026-04-23

Tag: `v1.0.0`

Commit: `3d29d47`

Initial baseline release.

What is in this version:
- global skill installation via Bun
- a data-driven skill list as the main source of truth
- intentionally minimal setup with no MCP layer yet

Why this matters:
- this is the simplest historical version of the project
- it provides the clean baseline from which all later MCP and multi-agent changes can be measured
