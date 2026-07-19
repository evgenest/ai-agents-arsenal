export type McpTarget =
  | "claude-code"
  | "vscode"
  | "antigravity"
  | "cursor"
  | "windsurf"
  | "codex"
  | "gemini-cli"
  | "kilo";

export const agentsConfig = [
  { id: "claude-code",     enabled: true,  mcpTargets: ["claude-code"], skillsPath: "~/.claude/skills" },
  { id: "hermes-agent",    enabled: true,  mcpTargets: [], skillsPath: "~/.hermes/skills" },
  { id: "antigravity-cli", enabled: true,  mcpTargets: ["antigravity"], skillsPath: "~/.gemini/antigravity-cli/skills" },
  { id: "gemini-cli",      enabled: true,  mcpTargets: ["gemini-cli"], skillsPath: "~/.gemini/skills" },
  { id: "github-copilot",  enabled: false, mcpTargets: ["vscode"] },
  { id: "antigravity",     enabled: false, mcpTargets: ["antigravity"], skillsPath: "~/.gemini/antigravity/skills" },
  { id: "cursor",          enabled: false, mcpTargets: ["cursor"] },
  { id: "windsurf",        enabled: false, mcpTargets: ["windsurf"] },
  { id: "codex",           enabled: false, mcpTargets: ["codex"] },
  { id: "kilo",            enabled: false, mcpTargets: ["kilo"] },
] as const;

export const activeAgents = agentsConfig
  .filter((a) => a.enabled)
  .map((a) => a.id);

export const activeMcpTargets = [...new Set(
  agentsConfig
    .filter((a) => a.enabled)
    .flatMap((a) => a.mcpTargets)
)] as McpTarget[];
