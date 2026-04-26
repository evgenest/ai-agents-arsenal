import type { McpTarget } from "../config/agents.config";
import type { McpServer } from "../config/mcp.config";
import { setupAntigravityMcp } from "./mcp/targets/antigravity";
import { setupClaudeCodeMcp } from "./mcp/targets/claude-code";
import { setupCodexMcp } from "./mcp/targets/codex";
import { setupCursorMcp } from "./mcp/targets/cursor";
import { setupGeminiCliMcp } from "./mcp/targets/gemini-cli";
import { setupKiloMcp } from "./mcp/targets/kilo";
import { setupVscodeMcp } from "./mcp/targets/vscode";
import { setupWindsurfMcp } from "./mcp/targets/windsurf";

const mcpSetupByTarget: Record<McpTarget, (mcpServers: Record<string, McpServer>) => Promise<void>> = {
  "claude-code": setupClaudeCodeMcp,
  vscode: setupVscodeMcp,
  antigravity: setupAntigravityMcp,
  cursor: setupCursorMcp,
  windsurf: setupWindsurfMcp,
  codex: setupCodexMcp,
  "gemini-cli": setupGeminiCliMcp,
  kilo: setupKiloMcp,
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
