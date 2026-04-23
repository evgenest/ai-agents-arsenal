import { mcpServers } from "../../../config/mcp.config";
import { convertServerForCursor } from "../core/converters";
import { backupIfExists, ensureParentDir } from "../core/files";
import { readJsonObject, type JsonObject } from "../core/json";
import { getCursorMcpPath } from "../core/paths";

export async function setupCursorMcp() {
  const mcpJsonPath = getCursorMcpPath();
  ensureParentDir(mcpJsonPath);

  const backup = await backupIfExists(mcpJsonPath);
  if (backup) console.log(`Existing Cursor MCP config backed up to ${backup}`);

  const existing = await readJsonObject(mcpJsonPath);
  const existingServers = (existing.mcpServers as JsonObject | undefined) ?? {};
  const config = {
    ...existing,
    mcpServers: {
      ...existingServers,
      ...Object.fromEntries(
        Object.entries(mcpServers).map(([name, server]) => [name, convertServerForCursor(server)]),
      ),
    },
  };

  await Bun.write(mcpJsonPath, JSON.stringify(config, null, 2));
  console.log(`MCP servers written to ${mcpJsonPath}`);
}
