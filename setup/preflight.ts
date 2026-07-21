import type { McpServer } from "../config/mcp.config";
import type { ConfigSource, LoadedSetupConfig } from "./config";
import { getAntigravityMcpPath } from "./mcp/core/paths";
import type { SkillsInstallScope } from "./skills";

type SetupPreviewSelection = {
  runSkills: boolean;
  runMcp: boolean;
  skillsInstallScope: SkillsInstallScope;
};

const ENV_REFERENCE_PATTERN = /\$\{([A-Z0-9_]+)\}/g;

export function printSetupPreview(selection: SetupPreviewSelection, config: LoadedSetupConfig) {
  const sections: string[] = [];

  if (selection.runSkills) {
    sections.push(buildSkillsPreview(selection.skillsInstallScope, config));
  }

  if (selection.runMcp) {
    sections.push(buildMcpPreview(config));
  }

  if (sections.length > 0) {
    console.log(`\n${sections.join("\n\n")}`);
  }
}

function buildSkillsPreview(scope: SkillsInstallScope, config: LoadedSetupConfig): string {
  const allSkills = config.skillsConfig.flatMap((entry) => entry.skills);
  const lines = [
    "Setup preview: skills",
    `- Install scope: ${scope}`,
    `- Active agents: ${formatList(config.activeAgents)}`,
    `- Skills to install: ${formatList(allSkills)}`,
    `- Agents config: ${describeSource(config.sources.agents)}`,
    `- Skills config: ${describeSource(config.sources.skills)}`,
  ];

  if (config.sources.agents.kind === "default" || config.sources.skills.kind === "default") {
    lines.push("- Warning: using built-in package skill defaults.");
    lines.push(`- Published defaults: ${config.sources.agents.releaseUrl} and ${config.sources.skills.releaseUrl}`);
    lines.push(`- Override with ${config.sources.agents.flag} <path> and ${config.sources.skills.flag} <path>`);
  }

  return lines.join("\n");
}

function buildMcpPreview(config: LoadedSetupConfig): string {
  const envVars = collectMcpEnvVars(config.mcpServers);
  const npxServerNames = Object.entries(config.mcpServers)
    .filter(([, server]) => isStdioServer(server) && server.command === "npx")
    .map(([name]) => name);
  const lines = [
    "Setup preview: MCP",
    `- Active targets: ${formatList(config.activeMcpTargets)}`,
    `- MCP servers to write: ${formatList(Object.keys(config.mcpServers))}`,
    `- Agents config: ${describeSource(config.sources.agents)}`,
    `- MCP config: ${describeSource(config.sources.mcp)}`,
    `- Env var references: ${envVars.length > 0 ? envVars.join(", ") : "none detected"}`,
    "- Config rule: use ${VAR_NAME} syntax for environment references in config files.",
  ];

  if (npxServerNames.length > 0) {
    lines.push(`- npm MCP rule: keep \"-y\" as the first arg for npx-based servers (${npxServerNames.join(", ")}).`);
  }

  if (config.sources.agents.kind === "default" || config.sources.mcp.kind === "default") {
    lines.push("- Warning: using built-in package MCP defaults.");
    lines.push(`- Published defaults: ${config.sources.agents.releaseUrl} and ${config.sources.mcp.releaseUrl}`);
    lines.push(`- Override with ${config.sources.agents.flag} <path> and ${config.sources.mcp.flag} <path>`);
  }

  return lines.join("\n");
}

function describeSource(source: ConfigSource): string {
  const label = source.kind === "default" ? "default package file" : "custom file";
  return `${label} at ${source.path}`;
}

export function getMissingMcpEnvVars(mcpServers: Record<string, McpServer>): string[] {
  return collectMcpEnvVars(mcpServers).filter((variableName) => !process.env[variableName]);
}

// "antigravity" (IDE) and "antigravity-cli" (CLI) are separate McpTargets,
// matching the separate skills agent IDs each has (see agents.config.ts) —
// but both resolve to the one file Antigravity IDE and CLI share
// (~/.gemini/config/mcp_config.json, per https://antigravity.google/docs/mcp),
// so a single label lookup keyed by McpTarget covers both correctly.
const ANTIGRAVITY_TARGET_LABELS: Record<string, string> = {
  antigravity: "Antigravity",
  "antigravity-cli": "Antigravity CLI",
};

export function printMissingMcpEnvVarsSummary(mcpServers: Record<string, McpServer>, activeMcpTargets: string[]) {
  const missing = getMissingMcpEnvVars(mcpServers);
  if (missing.length === 0) return;

  console.log("\n┌────────────────────────────────────────────────────────────");
  console.log("│  MCP ENV VARS WARNING");
  console.log("├────────────────────────────────────────────────────────────");
  console.log(`│  ✗ Not set in this shell (${missing.length}):`);
  console.log(`│    ${missing.join(", ")}`);
  console.log("│  MCP servers needing these may fail to start until you export");
  console.log("│  them (values are never read or logged by this check).");

  const antigravityLabel = describeAntigravityTargets(activeMcpTargets);
  if (antigravityLabel) {
    const locations = findEnvVarLocations(mcpServers, missing);
    console.log("├────────────────────────────────────────────────────────────");
    console.log(`│  ${antigravityLabel} bakes literal values into its config file — it`);
    console.log("│  does not support ${VAR} references. Open this file and fill");
    console.log("│  in the empty values by hand:");
    console.log(`│    ${getAntigravityMcpPath()}`);
    for (const { variableName, jsonPath } of locations) {
      console.log(`│  - ${variableName} → ${jsonPath}`);
    }
  }

  console.log("└────────────────────────────────────────────────────────────\n");
}

function describeAntigravityTargets(activeMcpTargets: string[]): string | null {
  const labels = activeMcpTargets
    .map((target) => ANTIGRAVITY_TARGET_LABELS[target])
    .filter((label): label is string => Boolean(label));

  return labels.length > 0 ? labels.join(" and ") : null;
}

type EnvVarLocation = {
  variableName: string;
  jsonPath: string;
};

function findEnvVarLocations(mcpServers: Record<string, McpServer>, missing: string[]): EnvVarLocation[] {
  const missingSet = new Set(missing);
  const locations: EnvVarLocation[] = [];

  for (const [name, server] of Object.entries(mcpServers)) {
    if (isHttpServer(server)) {
      collectEnvVarLocation(server.url, `mcpServers.${name}.url`, missingSet, locations);
      for (const [header, value] of Object.entries(server.headers ?? {})) {
        collectEnvVarLocation(value, `mcpServers.${name}.headers.${header}`, missingSet, locations);
      }
      continue;
    }

    collectEnvVarLocation(server.command, `mcpServers.${name}.command`, missingSet, locations);
    (server.args ?? []).forEach((arg, index) => {
      collectEnvVarLocation(arg, `mcpServers.${name}.args[${index}]`, missingSet, locations);
    });
    for (const [key, value] of Object.entries(server.env ?? {})) {
      collectEnvVarLocation(value, `mcpServers.${name}.env.${key}`, missingSet, locations);
    }
  }

  return locations;
}

function collectEnvVarLocation(value: string, jsonPath: string, missing: Set<string>, out: EnvVarLocation[]) {
  for (const match of value.matchAll(ENV_REFERENCE_PATTERN)) {
    const variableName = match[1];
    if (variableName && missing.has(variableName)) {
      out.push({ variableName, jsonPath });
    }
  }
}

function collectMcpEnvVars(mcpServers: Record<string, McpServer>): string[] {
  const envVars = new Set<string>();

  for (const server of Object.values(mcpServers)) {
    if (isHttpServer(server)) {
      collectEnvVarsFromValue(server.url, envVars);
      for (const value of Object.values(server.headers ?? {})) {
        collectEnvVarsFromValue(value, envVars);
      }
      continue;
    }

    collectEnvVarsFromValue(server.command, envVars);
    for (const arg of server.args ?? []) {
      collectEnvVarsFromValue(arg, envVars);
    }
    for (const value of Object.values(server.env ?? {})) {
      collectEnvVarsFromValue(value, envVars);
    }
  }

  return [...envVars];
}

function collectEnvVarsFromValue(value: string, envVars: Set<string>) {
  for (const match of value.matchAll(ENV_REFERENCE_PATTERN)) {
    const variableName = match[1];
    if (variableName) {
      envVars.add(variableName);
    }
  }
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function isHttpServer(server: McpServer): server is Extract<McpServer, { type: "http" }> {
  return "type" in server && server.type === "http";
}

function isStdioServer(server: McpServer): server is Exclude<McpServer, { type: "http" }> {
  return !isHttpServer(server);
}
