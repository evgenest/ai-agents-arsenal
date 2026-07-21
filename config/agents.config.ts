export type McpTarget =
  | "claude-code"
  | "vscode"
  | "antigravity"
  | "antigravity-cli"
  | "cursor"
  | "windsurf"
  | "codex"
  | "kilo";

// skillsPath is each agent's global skills directory, as declared by the
// `skills` npm package (vercel-labs/skills) README's Supported Agents table.
// ai-agents-arsenal creates these symlinks itself rather than delegating to
// the `skills` CLI's own `-a` agent targeting — see setup/skills.ts.
//
// "antigravity" and "antigravity-cli" are separate McpTargets (matching the
// separate skills agent IDs, each with its own skillsPath below) even though
// both currently resolve to the same global MCP config file — Antigravity
// IDE and CLI share ~/.gemini/config/mcp_config.json per Google's docs
// (https://antigravity.google/docs/mcp).
export const agentsConfig = [
  { id: "claude-code",     enabled: true,  mcpTargets: ["claude-code"], skillsPath: "~/.claude/skills" },
  { id: "cursor",          enabled: true,  mcpTargets: ["cursor"], skillsPath: "~/.cursor/skills" },
  { id: "antigravity-cli", enabled: true,  mcpTargets: ["antigravity-cli"], skillsPath: "~/.gemini/antigravity-cli/skills" },
  { id: "hermes-agent",    enabled: false, mcpTargets: [], skillsPath: "~/.hermes/skills" },
] as const;

export const activeAgents = agentsConfig
  .filter((a) => a.enabled)
  .map((a) => a.id);

export const activeMcpTargets = [...new Set(
  agentsConfig
    .filter((a) => a.enabled)
    .flatMap((a) => a.mcpTargets)
)] as McpTarget[];
