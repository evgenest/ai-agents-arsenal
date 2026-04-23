# Changelog

This changelog documents the main historical release milestones of the project.

The entries below were created retroactively from the git history and Claude Code session history to capture what changed from version to version, not just to restate release summaries.

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