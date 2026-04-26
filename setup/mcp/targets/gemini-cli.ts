import type { McpServer } from "../../../config/mcp.config";
import { convertServerForGemini } from "../core/converters";
import { backupIfExists, ensureParentDir } from "../core/files";
import { readJsonObject, type JsonObject } from "../core/json";
import { getGeminiSettingsPath } from "../core/paths";

export async function setupGeminiCliMcp(mcpServers: Record<string, McpServer>) {
  const settingsPath = getGeminiSettingsPath();
  ensureParentDir(settingsPath);

  const backup = await backupIfExists(settingsPath);
  if (backup) console.log(`Existing Gemini CLI settings backed up to ${backup}`);

  const existing = await readJsonObject(settingsPath);
  const existingServers = (existing.mcpServers as JsonObject | undefined) ?? {};
  const config = {
    ...existing,
    mcpServers: {
      ...existingServers,
      ...Object.fromEntries(
        Object.entries(mcpServers).map(([name, server]) => [name, convertServerForGemini(server)]),
      ),
    },
  };

  await Bun.write(settingsPath, JSON.stringify(config, null, 2));
  console.log(`MCP servers written to ${settingsPath}`);
}
