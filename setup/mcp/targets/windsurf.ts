import type { McpServer } from "../../../config/mcp.config";
import { convertServerForWindsurf } from "../core/converters";
import { backupIfExists, ensureParentDir } from "../core/files";
import { readJsonObject, type JsonObject } from "../core/json";
import { getWindsurfMcpPath } from "../core/paths";

export async function setupWindsurfMcp(mcpServers: Record<string, McpServer>) {
  const mcpJsonPath = getWindsurfMcpPath();
  ensureParentDir(mcpJsonPath);

  const backup = await backupIfExists(mcpJsonPath);
  if (backup) console.log(`Existing Windsurf MCP config backed up to ${backup}`);

  const existing = await readJsonObject(mcpJsonPath);
  const existingServers = (existing.mcpServers as JsonObject | undefined) ?? {};
  const config = {
    ...existing,
    mcpServers: {
      ...existingServers,
      ...Object.fromEntries(
        Object.entries(mcpServers).map(([name, server]) => [name, convertServerForWindsurf(server)]),
      ),
    },
  };

  await Bun.write(mcpJsonPath, JSON.stringify(config, null, 2));
  console.log(`MCP servers written to ${mcpJsonPath}`);
}
