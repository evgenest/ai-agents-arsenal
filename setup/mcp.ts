import { copyFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { activeMcpTargets, type McpTarget } from "../config/agents.config";
import { mcpServers, type McpServer } from "../config/mcp.config";

type JsonObject = Record<string, unknown>;

const CODEX_MANAGED_SECTION_START = "# BEGIN ai-agents-arsenal MCP servers";
const CODEX_MANAGED_SECTION_END = "# END ai-agents-arsenal MCP servers";

function isHttpServer(server: McpServer): server is Extract<McpServer, { type: "http" }> {
  return "type" in server && server.type === "http";
}

async function backupIfExists(filePath: string): Promise<string | null> {
  if (!existsSync(filePath)) return null;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${filePath}.backup-${timestamp}`;
  copyFileSync(filePath, backupPath);
  return backupPath;
}

async function readJsonObject(filePath: string): Promise<JsonObject> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) return {};
  return (await file.json()) as JsonObject;
}

function stripJsonComments(text: string): string {
  let result = "";
  let inString = false;
  let stringDelimiter = "";
  let isEscaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1] ?? "";

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        result += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && nextChar === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      result += char;
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === stringDelimiter) {
        inString = false;
        stringDelimiter = "";
      }
      continue;
    }

    if ((char === '"' || char === "'") && !inString) {
      inString = true;
      stringDelimiter = char;
      result += char;
      continue;
    }

    if (char === "/" && nextChar === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && nextChar === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    result += char;
  }

  return result;
}

function parseJsonc(text: string): JsonObject {
  const withoutComments = stripJsonComments(text);
  const withoutTrailingCommas = withoutComments.replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(withoutTrailingCommas) as JsonObject;
}

async function readJsoncObject(filePath: string): Promise<JsonObject> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) return {};

  const text = await file.text();
  if (!text.trim()) return {};
  return parseJsonc(text);
}

function replaceEnvReferences(
  value: string,
  format: (variableName: string) => string,
): string {
  return value.replace(/\$\{(?!env:|input:)([^}]+)\}/g, (_, variableName: string) => format(variableName));
}

function toVscodeFormat(value: string): string {
  return replaceEnvReferences(value, (variableName) => `\${env:${variableName}}`);
}

function toEnvScopedFormat(value: string): string {
  return replaceEnvReferences(value, (variableName) => `\${env:${variableName}}`);
}

function toKiloFormat(value: string): string {
  return replaceEnvReferences(value, (variableName) => `{env:${variableName}}`);
}

function toGeminiEnvFormat(value: string): string {
  return replaceEnvReferences(value, (variableName) => `$${variableName}`);
}

function resolveEnvReferences(value: string): string {
  return replaceEnvReferences(value, (variableName) => process.env[variableName] ?? "");
}

function extractDirectEnvReference(value: string): string | null {
  const match = value.match(/^\$\{(?!env:|input:)([^}]+)\}$/);
  return match?.[1] ?? null;
}

function mapStringRecord(
  record: Record<string, string> | undefined,
  transform: (value: string) => string,
): Record<string, string> | undefined {
  if (!record) return undefined;
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, transform(value)]),
  );
}

function toTomlString(value: string): string {
  return JSON.stringify(value);
}

function toTomlArray(values: string[]): string {
  return `[${values.map(toTomlString).join(", ")}]`;
}

function toTomlInlineTable(values: Record<string, string>): string {
  return `{ ${Object.entries(values)
    .map(([key, value]) => `${toTomlString(key)} = ${toTomlString(value)}`)
    .join(", ")} }`;
}

function renderCodexServer(name: string, server: McpServer): string {
  const lines = [`[mcp_servers.${name}]`];

  if (isHttpServer(server)) {
    lines.push(`url = ${toTomlString(server.url)}`);

    const staticHeaders: Record<string, string> = {};
    const envHeaders: Record<string, string> = {};

    for (const [headerName, headerValue] of Object.entries(server.headers ?? {})) {
      const variableName = extractDirectEnvReference(headerValue);
      if (variableName) {
        envHeaders[headerName] = variableName;
      } else {
        staticHeaders[headerName] = resolveEnvReferences(headerValue);
      }
    }

    if (Object.keys(staticHeaders).length > 0) {
      lines.push(`http_headers = ${toTomlInlineTable(staticHeaders)}`);
    }
    if (Object.keys(envHeaders).length > 0) {
      lines.push(`env_http_headers = ${toTomlInlineTable(envHeaders)}`);
    }
    if (server.tools?.length) {
      lines.push(`enabled_tools = ${toTomlArray(server.tools)}`);
    }

    return `${lines.join("\n")}\n`;
  }

  lines.push(`command = ${toTomlString(server.command)}`);

  if (server.args?.length) {
    lines.push(`args = ${toTomlArray(server.args.map(resolveEnvReferences))}`);
  }

  const forwardedEnvVars: string[] = [];
  const staticEnv: Record<string, string> = {};

  for (const [envName, envValue] of Object.entries(server.env ?? {})) {
    const variableName = extractDirectEnvReference(envValue);
    if (variableName === envName) {
      forwardedEnvVars.push(envName);
    } else if (variableName) {
      staticEnv[envName] = process.env[variableName] ?? "";
    } else {
      staticEnv[envName] = envValue;
    }
  }

  if (forwardedEnvVars.length > 0) {
    lines.push(`env_vars = ${toTomlArray(forwardedEnvVars)}`);
  }
  if (Object.keys(staticEnv).length > 0) {
    lines.push(`[mcp_servers.${name}.env]`);
    for (const [envName, envValue] of Object.entries(staticEnv)) {
      lines.push(`${envName} = ${toTomlString(envValue)}`);
    }
  }
  if (server.tools?.length) {
    lines.push(`enabled_tools = ${toTomlArray(server.tools)}`);
  }

  return `${lines.join("\n")}\n`;
}

function renderCodexManagedSection(): string {
  const sections = Object.entries(mcpServers)
    .map(([name, server]) => renderCodexServer(name, server))
    .join("\n");

  return `${CODEX_MANAGED_SECTION_START}\n${sections.trim()}\n${CODEX_MANAGED_SECTION_END}`;
}

function upsertCodexManagedSection(existingText: string): string {
  const managedSection = renderCodexManagedSection();
  const existing = existingText.trimEnd();
  const sectionPattern = new RegExp(
    `${CODEX_MANAGED_SECTION_START}[\\s\\S]*?${CODEX_MANAGED_SECTION_END}`,
    "m",
  );

  if (sectionPattern.test(existing)) {
    return `${existing.replace(sectionPattern, managedSection)}\n`;
  }

  if (!existing) {
    return `${managedSection}\n`;
  }

  return `${existing}\n\n${managedSection}\n`;
}

function convertServerForVscode(server: McpServer): McpServer {
  if (isHttpServer(server)) {
    return {
      ...server,
      url: toVscodeFormat(server.url),
      headers: mapStringRecord(server.headers, toVscodeFormat),
    };
  }

  return {
    ...server,
    command: toVscodeFormat(server.command),
    args: server.args?.map(toVscodeFormat),
    env: mapStringRecord(server.env, toVscodeFormat),
  };
}

function convertServerForCursor(server: McpServer): JsonObject {
  if (isHttpServer(server)) {
    return {
      url: toEnvScopedFormat(server.url),
      headers: mapStringRecord(server.headers, toEnvScopedFormat),
      transport: "streamable-http",
    };
  }

  return {
    command: toEnvScopedFormat(server.command),
    args: server.args?.map(toEnvScopedFormat),
    env: mapStringRecord(server.env, toEnvScopedFormat),
  };
}

function convertServerForWindsurf(server: McpServer): JsonObject {
  if (isHttpServer(server)) {
    return {
      serverUrl: toEnvScopedFormat(server.url),
      headers: mapStringRecord(server.headers, toEnvScopedFormat),
    };
  }

  return {
    command: toEnvScopedFormat(server.command),
    args: server.args?.map(toEnvScopedFormat),
    env: mapStringRecord(server.env, toEnvScopedFormat),
  };
}

function convertServerForGemini(server: McpServer): JsonObject {
  if (isHttpServer(server)) {
    return {
      httpUrl: server.url,
      headers: mapStringRecord(server.headers, resolveEnvReferences),
      includeTools: server.tools,
    };
  }

  return {
    command: server.command,
    args: server.args?.map(resolveEnvReferences),
    env: mapStringRecord(server.env, toGeminiEnvFormat),
    includeTools: server.tools,
  };
}

function convertServerForKilo(server: McpServer): JsonObject {
  if (isHttpServer(server)) {
    return {
      type: "remote",
      url: server.url,
      headers: mapStringRecord(server.headers, toKiloFormat),
      enabled: true,
    };
  }

  const args = server.args?.map(toKiloFormat) ?? [];
  const command = process.platform === "win32"
    ? ["cmd", "/c", toKiloFormat(server.command), ...args]
    : [toKiloFormat(server.command), ...args];

  return {
    type: "local",
    command,
    environment: mapStringRecord(server.env, toKiloFormat),
    enabled: true,
  };
}

const mcpSetupByTarget: Record<McpTarget, () => Promise<void>> = {
  "claude-code": setupClaudeCodeMcp,
  vscode: setupVscodeMcp,
  cursor: setupCursorMcp,
  windsurf: setupWindsurfMcp,
  codex: setupCodexMcp,
  "gemini-cli": setupGeminiCliMcp,
  kilo: setupKiloMcp,
};

export async function setupMcp() {
  for (const target of activeMcpTargets) {
    await mcpSetupByTarget[target]();
  }
}

// Writes MCP servers to ~/.claude/settings.json (global — covers Claude Code CLI + VSCode extension)
export async function setupClaudeCodeMcp() {
  const claudeDir = join(homedir(), ".claude");
  mkdirSync(claudeDir, { recursive: true });

  const settingsPath = join(claudeDir, "settings.json");
  const backup = await backupIfExists(settingsPath);
  if (backup) console.log(`Existing settings backed up to ${backup}`);
  const settings = await readJsonObject(settingsPath);
  settings.mcpServers = { ...(settings.mcpServers ?? {}), ...mcpServers };
  await Bun.write(settingsPath, JSON.stringify(settings, null, 2));
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
  const backup = await backupIfExists(mcpJsonPath);
  if (backup) console.log(`Existing mcp.json backed up to ${backup}`);
  const existing = await readJsonObject(mcpJsonPath);
  const config = {
    ...existing,
    servers: {
      ...(existing.servers ?? {}),
      ...Object.fromEntries(
        Object.entries(mcpServers).map(([k, v]) => [k, convertServerForVscode(v)])
      ),
    },
  };
  await Bun.write(mcpJsonPath, JSON.stringify(config, null, 2));
  console.log(`MCP servers written to ${mcpJsonPath}`);
}

export async function setupCursorMcp() {
  const cursorDir = join(homedir(), ".cursor");
  mkdirSync(cursorDir, { recursive: true });

  const mcpJsonPath = join(cursorDir, "mcp.json");
  const backup = await backupIfExists(mcpJsonPath);
  if (backup) console.log(`Existing Cursor MCP config backed up to ${backup}`);

  const existing = await readJsonObject(mcpJsonPath);
  const config = {
    ...existing,
    mcpServers: {
      ...(existing.mcpServers ?? {}),
      ...Object.fromEntries(
        Object.entries(mcpServers).map(([name, server]) => [name, convertServerForCursor(server)]),
      ),
    },
  };

  await Bun.write(mcpJsonPath, JSON.stringify(config, null, 2));
  console.log(`MCP servers written to ${mcpJsonPath}`);
}

export async function setupWindsurfMcp() {
  const windsurfDir = join(homedir(), ".codeium", "windsurf");
  mkdirSync(windsurfDir, { recursive: true });

  const mcpJsonPath = join(windsurfDir, "mcp_config.json");
  const backup = await backupIfExists(mcpJsonPath);
  if (backup) console.log(`Existing Windsurf MCP config backed up to ${backup}`);

  const existing = await readJsonObject(mcpJsonPath);
  const config = {
    ...existing,
    mcpServers: {
      ...(existing.mcpServers ?? {}),
      ...Object.fromEntries(
        Object.entries(mcpServers).map(([name, server]) => [name, convertServerForWindsurf(server)]),
      ),
    },
  };

  await Bun.write(mcpJsonPath, JSON.stringify(config, null, 2));
  console.log(`MCP servers written to ${mcpJsonPath}`);
}

export async function setupCodexMcp() {
  const codexDir = join(homedir(), ".codex");
  mkdirSync(codexDir, { recursive: true });

  const configPath = join(codexDir, "config.toml");
  const backup = await backupIfExists(configPath);
  if (backup) console.log(`Existing Codex MCP config backed up to ${backup}`);

  const configFile = Bun.file(configPath);
  const existing = (await configFile.exists()) ? await configFile.text() : "";
  await Bun.write(configPath, upsertCodexManagedSection(existing));
  console.log(`MCP servers written to ${configPath}`);
}

export async function setupGeminiCliMcp() {
  const geminiDir = join(homedir(), ".gemini");
  mkdirSync(geminiDir, { recursive: true });

  const settingsPath = join(geminiDir, "settings.json");
  const backup = await backupIfExists(settingsPath);
  if (backup) console.log(`Existing Gemini CLI settings backed up to ${backup}`);

  const existing = await readJsonObject(settingsPath);
  const config = {
    ...existing,
    mcpServers: {
      ...(existing.mcpServers ?? {}),
      ...Object.fromEntries(
        Object.entries(mcpServers).map(([name, server]) => [name, convertServerForGemini(server)]),
      ),
    },
  };

  await Bun.write(settingsPath, JSON.stringify(config, null, 2));
  console.log(`MCP servers written to ${settingsPath}`);
}

export async function setupKiloMcp() {
  const kiloDir = join(homedir(), ".config", "kilo");
  mkdirSync(kiloDir, { recursive: true });

  const configPath = join(kiloDir, "kilo.jsonc");
  const backup = await backupIfExists(configPath);
  if (backup) console.log(`Existing Kilo config backed up to ${backup}`);

  const existing = await readJsoncObject(configPath);
  const config = {
    ...existing,
    mcp: {
      ...(existing.mcp ?? {}),
      ...Object.fromEntries(
        Object.entries(mcpServers).map(([name, server]) => [name, convertServerForKilo(server)]),
      ),
    },
  };

  await Bun.write(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`MCP servers written to ${configPath}`);
}
