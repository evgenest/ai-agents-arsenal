import type { McpTarget } from "../../../config/agents.config";
import type { McpServer } from "../../../config/mcp.config";
import {
  convertServerForAntigravity,
  convertServerForClaudeCode,
  convertServerForCursor,
  convertServerForKilo,
  convertServerForVscode,
  convertServerForWindsurf,
} from "../core/converters";
import { backupIfExists, ensureParentDir } from "../core/files";
import { readJsonObject, readJsoncObject, type JsonObject } from "../core/json";
import {
  getAntigravityMcpPath,
  getClaudeCodeMcpPath,
  getCursorMcpPath,
  getKiloConfigPath,
  getVscodeMcpPath,
  getWindsurfMcpPath,
} from "../core/paths";

// Every McpTarget except "codex" (which writes TOML via a differently-shaped
// writer — see codex.ts) follows the same recipe: read an existing JSON or
// JSONC config file, merge converted servers into one top-level key, and
// write it back. This type describes everything that differs between those
// targets; setupJsonMergeTarget() below is the one writer that runs all of
// them.
type JsonMergeTarget = {
  // Full noun phrase for the backup log line, e.g. "Existing {backupLabel}
  // backed up to {path}". Kept as one string (not product name + "MCP")
  // because wording isn't fully uniform today — Claude Code and Kilo say
  // "config", everything else says "MCP config".
  backupLabel: string;
  getPath: () => string;
  mergeKey: string;
  format: "json" | "jsonc";
  convert?: (server: McpServer) => Record<string, unknown>;
  trailingNewline?: boolean;
};

// Antigravity IDE and CLI share one MCP config file (see agents.config.ts's
// McpTarget note) — both entries point at the same path/key/converter and
// only differ in the console-facing label.
const jsonMergeTargets: Record<Exclude<McpTarget, "codex">, JsonMergeTarget> = {
  "claude-code": {
    backupLabel: "Claude Code config",
    getPath: getClaudeCodeMcpPath,
    mergeKey: "mcpServers",
    format: "json",
    convert: convertServerForClaudeCode,
  },
  vscode: {
    backupLabel: "VS Code MCP config",
    getPath: getVscodeMcpPath,
    mergeKey: "servers",
    format: "json",
    convert: convertServerForVscode,
  },
  antigravity: {
    backupLabel: "Antigravity MCP config",
    getPath: getAntigravityMcpPath,
    mergeKey: "mcpServers",
    format: "json",
    convert: convertServerForAntigravity,
  },
  "antigravity-cli": {
    backupLabel: "Antigravity CLI MCP config",
    getPath: getAntigravityMcpPath,
    mergeKey: "mcpServers",
    format: "json",
    convert: convertServerForAntigravity,
  },
  cursor: {
    backupLabel: "Cursor MCP config",
    getPath: getCursorMcpPath,
    mergeKey: "mcpServers",
    format: "json",
    convert: convertServerForCursor,
  },
  windsurf: {
    backupLabel: "Windsurf MCP config",
    getPath: getWindsurfMcpPath,
    mergeKey: "mcpServers",
    format: "json",
    convert: convertServerForWindsurf,
  },
  kilo: {
    backupLabel: "Kilo config",
    getPath: getKiloConfigPath,
    mergeKey: "mcp",
    format: "jsonc",
    convert: convertServerForKilo,
    trailingNewline: true,
  },
};

export async function setupJsonMergeTarget(
  target: Exclude<McpTarget, "codex">,
  mcpServers: Record<string, McpServer>,
) {
  const { backupLabel, getPath, mergeKey, format, convert, trailingNewline } = jsonMergeTargets[target];
  const configPath = getPath();
  ensureParentDir(configPath);

  const backup = await backupIfExists(configPath);
  if (backup) console.log(`Existing ${backupLabel} backed up to ${backup}`);

  const existing = format === "jsonc" ? await readJsoncObject(configPath) : await readJsonObject(configPath);
  const existingServers = (existing[mergeKey] as JsonObject | undefined) ?? {};
  const convertedServers = convert
    ? Object.fromEntries(Object.entries(mcpServers).map(([name, server]) => [name, convert(server)]))
    : mcpServers;

  const config = {
    ...existing,
    [mergeKey]: { ...existingServers, ...convertedServers },
  };

  const serialized = JSON.stringify(config, null, 2);
  await Bun.write(configPath, trailingNewline ? `${serialized}\n` : serialized);
  console.log(`MCP servers written to ${configPath}`);
}
