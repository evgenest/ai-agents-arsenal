import { mkdirSync, copyFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { mcpServers, type McpServer } from "../config/mcp.config";

async function backupIfExists(filePath: string): Promise<string | null> {
  if (!existsSync(filePath)) return null;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${filePath}.backup-${timestamp}`;
  copyFileSync(filePath, backupPath);
  return backupPath;
}

// Converts ${VAR} → ${env:VAR} for VSCode's mcp.json format
function toVscodeFormat(s: string): string {
  return s.replace(/\$\{(?!env:|input:)([^}]+)\}/g, "${env:$1}");
}

function convertServerForVscode(server: McpServer): McpServer {
  const s = { ...server } as Record<string, unknown>;
  if (s.env)
    s.env = Object.fromEntries(
      Object.entries(s.env as Record<string, string>).map(([k, v]) => [k, toVscodeFormat(v)])
    );
  if (s.headers)
    s.headers = Object.fromEntries(
      Object.entries(s.headers as Record<string, string>).map(([k, v]) => [k, toVscodeFormat(v)])
    );
  if (s.args) s.args = (s.args as string[]).map(toVscodeFormat);
  return s as McpServer;
}

// Writes MCP servers to ~/.claude/settings.json (global — covers Claude Code CLI + VSCode extension)
export async function setupClaudeCodeMcp() {
  const claudeDir = join(homedir(), ".claude");
  mkdirSync(claudeDir, { recursive: true });

  const settingsPath = join(claudeDir, "settings.json");
  const settingsFile = Bun.file(settingsPath);
  const backup = await backupIfExists(settingsPath);
  if (backup) console.log(`Existing settings backed up to ${backup}`);
  const settings = (await settingsFile.exists()) ? await settingsFile.json() : {};
  settings.mcpServers = { ...(settings.mcpServers ?? {}), ...mcpServers };
  await Bun.write(settingsFile, JSON.stringify(settings, null, 2));
  console.log(`MCP servers written to ${settingsPath}`);
}

// Writes to %APPDATA%\Code\User\mcp.json — global for all VS Code projects (Windows/macOS/Linux)
// Preserves existing servers and inputs; only merges our servers in.
export async function setupVscodeMcp() {
  const appData =
    process.env.APPDATA ??
    (process.platform === "darwin"
      ? join(homedir(), "Library", "Application Support")
      : join(homedir(), ".config"));

  const userDir = join(appData, "Code", "User");
  mkdirSync(userDir, { recursive: true });

  const mcpJsonPath = join(userDir, "mcp.json");
  const mcpJsonFile = Bun.file(mcpJsonPath);
  const backup = await backupIfExists(mcpJsonPath);
  if (backup) console.log(`Existing mcp.json backed up to ${backup}`);
  const existing = (await mcpJsonFile.exists()) ? await mcpJsonFile.json() : {};
  const config = {
    ...existing,
    servers: {
      ...(existing.servers ?? {}),
      ...Object.fromEntries(
        Object.entries(mcpServers).map(([k, v]) => [k, convertServerForVscode(v)])
      ),
    },
  };
  await Bun.write(mcpJsonFile, JSON.stringify(config, null, 2));
  console.log(`MCP servers written to ${mcpJsonPath}`);
}
