import type { McpServer } from "../../../config/mcp.config";
import { backupIfExists, ensureParentDir } from "../core/files";
import { readJsonObject, type JsonObject } from "../core/json";
import { getClaudeCodeMcpPath } from "../core/paths";

// ~/.claude.json holds far more than MCP config — OAuth account info, per-
// project state, caches — so only the top-level "mcpServers" key is ever
// touched here; everything else is read back byte-for-byte and rewritten
// unchanged.
export async function setupClaudeCodeMcp(mcpServers: Record<string, McpServer>) {
  const mcpConfigPath = getClaudeCodeMcpPath();
  ensureParentDir(mcpConfigPath);

  const backup = await backupIfExists(mcpConfigPath);
  if (backup) console.log(`Existing Claude Code config backed up to ${backup}`);

  const config = await readJsonObject(mcpConfigPath);
  const existingServers = (config.mcpServers as JsonObject | undefined) ?? {};
  config.mcpServers = { ...existingServers, ...mcpServers };

  await Bun.write(mcpConfigPath, JSON.stringify(config, null, 2));
  console.log(`MCP servers written to ${mcpConfigPath}`);
}
