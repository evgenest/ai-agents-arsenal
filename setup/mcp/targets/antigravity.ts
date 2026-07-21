import type { McpServer } from "../../../config/mcp.config";
import { convertServerForAntigravity } from "../core/converters";
import { backupIfExists, ensureParentDir } from "../core/files";
import { readJsonObject, type JsonObject } from "../core/json";
import { getAntigravityMcpPath } from "../core/paths";

// Antigravity IDE and CLI share one MCP config file (see agents.config.ts's
// McpTarget note), so both targets funnel through this writer — only the
// console-facing label differs, to match whichever product is actually active.
async function writeAntigravityMcp(mcpServers: Record<string, McpServer>, label: string) {
  const mcpConfigPath = getAntigravityMcpPath();
  ensureParentDir(mcpConfigPath);

  const backup = await backupIfExists(mcpConfigPath);
  if (backup) console.log(`Existing ${label} MCP config backed up to ${backup}`);

  const existing = await readJsonObject(mcpConfigPath);
  const existingServers = (existing.mcpServers as JsonObject | undefined) ?? {};
  const config = {
    ...existing,
    mcpServers: {
      ...existingServers,
      ...Object.fromEntries(
        Object.entries(mcpServers).map(([name, server]) => [name, convertServerForAntigravity(server)]),
      ),
    },
  };

  await Bun.write(mcpConfigPath, JSON.stringify(config, null, 2));
  console.log(`MCP servers written to ${mcpConfigPath}`);
}

export async function setupAntigravityMcp(mcpServers: Record<string, McpServer>) {
  await writeAntigravityMcp(mcpServers, "Antigravity");
}

export async function setupAntigravityCliMcp(mcpServers: Record<string, McpServer>) {
  await writeAntigravityMcp(mcpServers, "Antigravity CLI");
}