import { mcpServers } from "../../../config/mcp.config";
import { backupIfExists, ensureParentDir } from "../core/files";
import { readJsonObject, type JsonObject } from "../core/json";
import { getClaudeCodeSettingsPath } from "../core/paths";

export async function setupClaudeCodeMcp() {
  const settingsPath = getClaudeCodeSettingsPath();
  ensureParentDir(settingsPath);

  const backup = await backupIfExists(settingsPath);
  if (backup) console.log(`Existing settings backed up to ${backup}`);

  const settings = await readJsonObject(settingsPath);
  const existingServers = (settings.mcpServers as JsonObject | undefined) ?? {};
  settings.mcpServers = { ...existingServers, ...mcpServers };

  await Bun.write(settingsPath, JSON.stringify(settings, null, 2));
  console.log(`MCP servers written to ${settingsPath}`);
}
