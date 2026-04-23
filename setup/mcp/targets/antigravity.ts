import { mcpServers } from "../../../config/mcp.config";
import { convertServerForAntigravity } from "../core/converters";
import { backupIfExists, ensureParentDir } from "../core/files";
import { readJsonObject, type JsonObject } from "../core/json";
import { getAntigravityMcpPath } from "../core/paths";

export async function setupAntigravityMcp() {
  const mcpConfigPath = getAntigravityMcpPath();
  ensureParentDir(mcpConfigPath);

  const backup = await backupIfExists(mcpConfigPath);
  if (backup) console.log(`Existing Antigravity MCP config backed up to ${backup}`);

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