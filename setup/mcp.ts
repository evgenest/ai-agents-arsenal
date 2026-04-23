import { mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { mcpServers, type McpServer } from "../config/mcp.config";

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

  const settingsFile = Bun.file(join(claudeDir, "settings.json"));
  const settings = (await settingsFile.exists()) ? await settingsFile.json() : {};
  settings.mcpServers = { ...(settings.mcpServers ?? {}), ...mcpServers };
  await Bun.write(settingsFile, JSON.stringify(settings, null, 2));
  console.log(`MCP servers written to ${join(claudeDir, "settings.json")}`);
}

// Writes .vscode/mcp.json in cwd — run with --vscode from your project root
export async function setupVscodeMcp() {
  const vscodeDir = join(process.cwd(), ".vscode");
  mkdirSync(vscodeDir, { recursive: true });

  const mcpJsonFile = Bun.file(join(vscodeDir, "mcp.json"));
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
  console.log(`MCP servers written to ${join(vscodeDir, "mcp.json")}`);
}
