import { mcpServers, type McpServer } from "../../../config/mcp.config";
import { extractDirectEnvReference, resolveEnvReferences } from "./env";
import { isHttpServer } from "./server";

const CODEX_MANAGED_SECTION_START = "# BEGIN ai-agents-arsenal MCP servers";
const CODEX_MANAGED_SECTION_END = "# END ai-agents-arsenal MCP servers";

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

export function upsertCodexManagedSection(existingText: string): string {
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
