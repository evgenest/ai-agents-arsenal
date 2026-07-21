import { homedir } from "os";
import { join } from "path";

export function getAppDataDir(): string {
  return process.env.APPDATA ??
    (process.platform === "darwin"
      ? join(homedir(), "Library", "Application Support")
      : join(homedir(), ".config"));
}

// Claude Code doesn't read MCP servers from ~/.claude/settings.json (that
// file is for permissions/hooks/env, not MCP) — user-scoped MCP servers
// (available across all projects, matching every other target in this repo)
// live in the top-level "mcpServers" key of ~/.claude.json instead. See
// https://code.claude.com/docs/en/mcp#user-scope.
export function getClaudeCodeMcpPath(): string {
  return join(homedir(), ".claude.json");
}

export function getVscodeMcpPath(): string {
  return join(getAppDataDir(), "Code", "User", "mcp.json");
}

export function getAntigravityMcpPath(): string {
  return join(homedir(), ".gemini", "config", "mcp_config.json");
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

export function getKiloConfigPath(): string {
  return join(homedir(), ".config", "kilo", "kilo.jsonc");
}
