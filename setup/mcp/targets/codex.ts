import type { McpServer } from "../../../config/mcp.config";
import { upsertCodexManagedSection } from "../core/codex";
import { backupIfExists, ensureParentDir } from "../core/files";
import { getCodexConfigPath } from "../core/paths";

export async function setupCodexMcp(mcpServers: Record<string, McpServer>) {
  const configPath = getCodexConfigPath();
  ensureParentDir(configPath);

  const backup = await backupIfExists(configPath);
  if (backup) console.log(`Existing Codex MCP config backed up to ${backup}`);

  const configFile = Bun.file(configPath);
  const existing = (await configFile.exists()) ? await configFile.text() : "";

  await Bun.write(configPath, upsertCodexManagedSection(existing, mcpServers));
  console.log(`MCP servers written to ${configPath}`);
}
