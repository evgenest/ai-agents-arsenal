import { homedir } from "os";
import { join } from "path";

export function getAppDataDir(): string {
  return process.env.APPDATA ??
    (process.platform === "darwin"
      ? join(homedir(), "Library", "Application Support")
      : join(homedir(), ".config"));
}

export function getClaudeCodeSettingsPath(): string {
  return join(homedir(), ".claude", "settings.json");
}

export function getVscodeMcpPath(): string {
  return join(getAppDataDir(), "Code", "User", "mcp.json");
}

export function getAntigravityMcpPath(): string {
  return join(homedir(), ".gemini", "antigravity", "mcp_config.json");
}

export function getCursorMcpPath(): string {
  return join(homedir(), ".cursor", "mcp.json");
}

export function getWindsurfMcpPath(): string {
  return join(homedir(), ".codeium", "windsurf", "mcp_config.json");
}

export function getCodexConfigPath(): string {
  return join(homedir(), ".codex", "config.toml");
}

export function getGeminiSettingsPath(): string {
  return join(homedir(), ".gemini", "settings.json");
}

export function getKiloConfigPath(): string {
  return join(homedir(), ".config", "kilo", "kilo.jsonc");
}
