import type { McpServer } from "../../../config/mcp.config";
import { convertServerForKilo } from "../core/converters";
import { backupIfExists, ensureParentDir } from "../core/files";
import { readJsoncObject, type JsonObject } from "../core/json";
import { getKiloConfigPath } from "../core/paths";

export async function setupKiloMcp(mcpServers: Record<string, McpServer>) {
  const configPath = getKiloConfigPath();
  ensureParentDir(configPath);

  const backup = await backupIfExists(configPath);
  if (backup) console.log(`Existing Kilo config backed up to ${backup}`);

  const existing = await readJsoncObject(configPath);
  const existingMcp = (existing.mcp as JsonObject | undefined) ?? {};
  const config = {
    ...existing,
    mcp: {
      ...existingMcp,
      ...Object.fromEntries(
        Object.entries(mcpServers).map(([name, server]) => [name, convertServerForKilo(server)]),
      ),
    },
  };

  await Bun.write(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`MCP servers written to ${configPath}`);
}
