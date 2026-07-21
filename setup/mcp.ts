import type { McpTarget } from "../config/agents.config";
import type { McpServer } from "../config/mcp.config";
import { setupCodexMcp } from "./mcp/targets/codex";
import { setupJsonMergeTarget } from "./mcp/targets/json-merge";

const mcpSetupByTarget: Record<McpTarget, (mcpServers: Record<string, McpServer>) => Promise<void>> = {
  "claude-code": (mcpServers) => setupJsonMergeTarget("claude-code", mcpServers),
  vscode: (mcpServers) => setupJsonMergeTarget("vscode", mcpServers),
  antigravity: (mcpServers) => setupJsonMergeTarget("antigravity", mcpServers),
  "antigravity-cli": (mcpServers) => setupJsonMergeTarget("antigravity-cli", mcpServers),
  cursor: (mcpServers) => setupJsonMergeTarget("cursor", mcpServers),
  windsurf: (mcpServers) => setupJsonMergeTarget("windsurf", mcpServers),
  codex: setupCodexMcp,
  kilo: (mcpServers) => setupJsonMergeTarget("kilo", mcpServers),
};

export async function setupMcp(activeMcpTargets: string[], mcpServers: Record<string, McpServer>) {
  for (const target of activeMcpTargets) {
    const setupTarget = mcpSetupByTarget[target as McpTarget];
    if (!setupTarget) {
      throw new Error(`Unsupported MCP target in agents config: ${target}`);
    }

    await setupTarget(mcpServers);
  }
}
