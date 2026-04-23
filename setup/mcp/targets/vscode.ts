import { mcpServers } from "../../../config/mcp.config";
import { convertServerForVscode } from "../core/converters";
import { backupIfExists, ensureParentDir } from "../core/files";
import { readJsonObject, type JsonObject } from "../core/json";
import { getVscodeMcpPath } from "../core/paths";

export async function setupVscodeMcp() {
  const mcpJsonPath = getVscodeMcpPath();
  ensureParentDir(mcpJsonPath);

  const backup = await backupIfExists(mcpJsonPath);
  if (backup) console.log(`Existing mcp.json backed up to ${backup}`);

  const existing = await readJsonObject(mcpJsonPath);
  const existingServers = (existing.servers as JsonObject | undefined) ?? {};
  const config = {
    ...existing,
    servers: {
      ...existingServers,
      ...Object.fromEntries(
        Object.entries(mcpServers).map(([name, server]) => [name, convertServerForVscode(server)]),
      ),
    },
  };

  await Bun.write(mcpJsonPath, JSON.stringify(config, null, 2));
  console.log(`MCP servers written to ${mcpJsonPath}`);
}
