# Changelog

This changelog documents the main historical release milestones of the project.

The entries below were created retroactively from the git history and Claude Code session history to capture what changed from version to version, not just to restate release summaries.

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