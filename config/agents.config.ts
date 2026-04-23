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
  { id: "claude-code",    enabled: true,  mcpTargets: ["claude-code"] },
  { id: "github-copilot", enabled: true,  mcpTargets: ["vscode"] },
  { id: "antigravity",    enabled: true,  mcpTargets: ["antigravity"] },
  { id: "cursor",         enabled: false, mcpTargets: ["cursor"] },
  { id: "windsurf",       enabled: false, mcpTargets: ["windsurf"] },
  { id: "codex",          enabled: false, mcpTargets: ["codex"] },
  { id: "gemini-cli",     enabled: false, mcpTargets: ["gemini-cli"] },
  { id: "kilo",           enabled: false, mcpTargets: ["kilo"] },
] as const;

export const activeAgents = agentsConfig
  .filter((a) => a.enabled)
  .map((a) => a.id);

export const activeMcpTargets = [...new Set(
  agentsConfig
    .filter((a) => a.enabled)
    .flatMap((a) => a.mcpTargets)
)] as McpTarget[];
