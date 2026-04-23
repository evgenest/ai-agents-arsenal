export type McpTarget = "claude-code" | "vscode";

export const agentsConfig = [
  { id: "claude-code",    enabled: true,  mcpTargets: ["claude-code"] },
  { id: "github-copilot", enabled: true,  mcpTargets: ["vscode"] },
  { id: "antigravity",    enabled: true,  mcpTargets: ["vscode"] },
  { id: "cursor",         enabled: false, mcpTargets: [] },
  { id: "windsurf",       enabled: false, mcpTargets: [] },
  { id: "codex",          enabled: false, mcpTargets: [] },
  { id: "gemini-cli",     enabled: false, mcpTargets: [] },
  { id: "kilo",           enabled: false, mcpTargets: [] },
] as const;

export const activeAgents = agentsConfig
  .filter((a) => a.enabled)
  .map((a) => a.id);

export const activeMcpTargets = [...new Set(
  agentsConfig
    .filter((a) => a.enabled)
    .flatMap((a) => a.mcpTargets)
)] as McpTarget[];
