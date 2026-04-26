import type { McpServer } from "../config/mcp.config";
import type { ConfigSource, LoadedSetupConfig } from "./config";
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
