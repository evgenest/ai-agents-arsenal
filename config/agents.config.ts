export type McpTarget =
  | "claude-code"
  | "vscode"
  | "antigravity"
  | "cursor"
  | "windsurf"
  | "codex"
  | "gemini-cli"
  | "kilo";

// skillsPath is each agent's global skills directory, as declared by the
// `skills` npm package (vercel-labs/skills) README's Supported Agents table.
// ai-agents-arsenal creates these symlinks itself rather than delegating to
// the `skills` CLI's own `-a` agent targeting — see setup/skills.ts.
export const agentsConfig = [
  { id: "claude-code",     enabled: true,  mcpTargets: ["claude-code"], skillsPath: "~/.claude/skills" },
  { id: "hermes-agent",    enabled: false, mcpTargets: [], skillsPath: "~/.hermes/skills" },
  { id: "antigravity-cli", enabled: true,  mcpTargets: ["antigravity"], skillsPath: "~/.gemini/antigravity-cli/skills" },
  { id: "cursor",          enabled: true,  mcpTargets: ["cursor"], skillsPath: "~/.cursor/skills" },
] as const;

export const activeAgents = agentsConfig
  .filter((a) => a.enabled)
  .map((a) => a.id);

export const activeMcpTargets = [...new Set(
  agentsConfig
    .filter((a) => a.enabled)
    .flatMap((a) => a.mcpTargets)
)] as McpTarget[];
