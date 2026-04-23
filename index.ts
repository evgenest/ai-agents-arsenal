import { $ } from "bun";
import { mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { mcpServers, type McpServer } from "./mcp.config";
import { skillsConfig } from "./skills.config";

// Skills — install globally via Claude Code
for (const entry of skillsConfig) {
  const skillArgs = entry.skills.flatMap((s) => ["--skill", s]);
  await $`bunx skills add ${entry.repo} ${skillArgs} -g -a claude-code -y`;
}

// MCPs — write to ~/.claude/settings.json (covers Claude Code in terminal + VSCode extension)
const claudeDir = join(homedir(), ".claude");
mkdirSync(claudeDir, { recursive: true });

const settingsFile = Bun.file(join(claudeDir, "settings.json"));
const settings = (await settingsFile.exists()) ? await settingsFile.json() : {};
settings.mcpServers = { ...(settings.mcpServers ?? {}), ...mcpServers };
await Bun.write(settingsFile, JSON.stringify(settings, null, 2));
console.log(`MCP servers written to ${join(claudeDir, "settings.json")}`);

// MCPs — write .vscode/mcp.json for GitHub Copilot Chat (run with --vscode from your project root)
if (process.argv.includes("--vscode")) {
  // VSCode uses ${env:VAR} syntax instead of Claude Code's ${VAR}
  const toVscode = (s: string) =>
    s.replace(/\$\{(?!env:|input:)([^}]+)\}/g, "${env:$1}");

  const convertServer = (server: McpServer): McpServer => {
    const s = { ...server } as Record<string, unknown>;
    if (s.env)
      s.env = Object.fromEntries(
        Object.entries(s.env as Record<string, string>).map(([k, v]) => [k, toVscode(v)])
      );
    if (s.headers)
      s.headers = Object.fromEntries(
        Object.entries(s.headers as Record<string, string>).map(([k, v]) => [k, toVscode(v)])
      );
    if (s.args) s.args = (s.args as string[]).map(toVscode);
    return s as McpServer;
  };

  const vscodeDir = join(process.cwd(), ".vscode");
  mkdirSync(vscodeDir, { recursive: true });

  const mcpJsonFile = Bun.file(join(vscodeDir, "mcp.json"));
  const existing = (await mcpJsonFile.exists()) ? await mcpJsonFile.json() : {};
  const vscodeConfig = {
    ...existing,
    servers: {
      ...(existing.servers ?? {}),
      ...Object.fromEntries(
        Object.entries(mcpServers).map(([k, v]) => [k, convertServer(v)])
      ),
    },
  };
  await Bun.write(mcpJsonFile, JSON.stringify(vscodeConfig, null, 2));
  console.log(`MCP servers written to ${join(vscodeDir, "mcp.json")}`);
}
