import { activeMcpTargets, type McpTarget } from "../config/agents.config";
import { setupClaudeCodeMcp } from "./mcp/targets/claude-code";
import { setupCodexMcp } from "./mcp/targets/codex";
import { setupCursorMcp } from "./mcp/targets/cursor";
import { setupGeminiCliMcp } from "./mcp/targets/gemini-cli";
import { setupKiloMcp } from "./mcp/targets/kilo";
import { setupVscodeMcp } from "./mcp/targets/vscode";
import { setupWindsurfMcp } from "./mcp/targets/windsurf";

const mcpSetupByTarget: Record<McpTarget, () => Promise<void>> = {
  "claude-code": setupClaudeCodeMcp,
  vscode: setupVscodeMcp,
  cursor: setupCursorMcp,
  windsurf: setupWindsurfMcp,
  codex: setupCodexMcp,
  "gemini-cli": setupGeminiCliMcp,
  kilo: setupKiloMcp,
};

export async function setupMcp() {
  for (const target of activeMcpTargets) {
    await mcpSetupByTarget[target]();
  }
}
