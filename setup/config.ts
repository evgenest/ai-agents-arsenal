import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { McpTarget } from "../config/agents.config";
import type { McpServer } from "../config/mcp.config";

export type AgentConfigEntry = {
  id: string;
  enabled: boolean;
  mcpTargets: string[];
};

export type SkillsConfigEntry = {
  repo: string;
  skills: string[];
};

export type ConfigPathOverrides = {
  agentsConfigPath?: string;
  skillsConfigPath?: string;
  mcpConfigPath?: string;
};

export type ConfigSource = {
  kind: "default" | "custom";
  flag: string;
  path: string;
  defaultRelativePath: string;
  releaseUrl: string;
};

export type LoadedSetupConfig = {
  agentsConfig: AgentConfigEntry[];
  skillsConfig: SkillsConfigEntry[];
  mcpServers: Record<string, McpServer>;
  activeAgents: string[];
  activeMcpTargets: string[];
  packageVersion: string;
  sources: {
    agents: ConfigSource;
    skills: ConfigSource;
    mcp: ConfigSource;
  };
};

type RuntimeConfigModule = {
  agentsConfig?: unknown;
  skillsConfig?: unknown;
  mcpServers?: unknown;
};

const PACKAGE_ROOT = resolve(import.meta.dir, "..");

const DEFAULT_CONFIG_FILES = {
  agents: "config/agents.config.ts",
  skills: "config/skills.config.ts",
  mcp: "config/mcp.config.ts",
} as const;

const CONFIG_FLAGS = {
  agents: "--agents-config",
  skills: "--skills-config",
  mcp: "--mcp-config",
} as const;

const SUPPORTED_MCP_TARGETS = new Set<McpTarget>([
  "claude-code",
  "vscode",
  "antigravity",
  "cursor",
  "windsurf",
  "codex",
  "gemini-cli",
  "kilo",
]);

export async function loadSetupConfig(overrides: ConfigPathOverrides = {}): Promise<LoadedSetupConfig> {
  const packageVersion = await readPackageVersion();
  const sources = {
    agents: resolveConfigSource(DEFAULT_CONFIG_FILES.agents, overrides.agentsConfigPath, CONFIG_FLAGS.agents, packageVersion),
    skills: resolveConfigSource(DEFAULT_CONFIG_FILES.skills, overrides.skillsConfigPath, CONFIG_FLAGS.skills, packageVersion),
    mcp: resolveConfigSource(DEFAULT_CONFIG_FILES.mcp, overrides.mcpConfigPath, CONFIG_FLAGS.mcp, packageVersion),
  };

  const [agentsModule, skillsModule, mcpModule] = await Promise.all([
    importConfigModule(sources.agents.path, "agents"),
    importConfigModule(sources.skills.path, "skills"),
    importConfigModule(sources.mcp.path, "mcp"),
  ]);

  const agentsConfig = parseAgentsConfig(agentsModule.agentsConfig, sources.agents.path);
  const skillsConfig = parseSkillsConfig(skillsModule.skillsConfig, sources.skills.path);
  const mcpServers = parseMcpServers(mcpModule.mcpServers, sources.mcp.path);
  const activeAgents = agentsConfig.filter((entry) => entry.enabled).map((entry) => entry.id);
  const activeMcpTargets = [...new Set(
    agentsConfig
      .filter((entry) => entry.enabled)
      .flatMap((entry) => entry.mcpTargets),
  )];

  const unsupportedTargets = activeMcpTargets.filter((target) => !SUPPORTED_MCP_TARGETS.has(target as McpTarget));
  if (unsupportedTargets.length > 0) {
    throw new Error(
      `Unsupported MCP targets in ${sources.agents.path}: ${unsupportedTargets.join(", ")}. `
      + `Supported targets: ${[...SUPPORTED_MCP_TARGETS].join(", ")}`,
    );
  }

  return {
    agentsConfig,
    skillsConfig,
    mcpServers,
    activeAgents,
    activeMcpTargets,
    packageVersion,
    sources,
  };
}

async function readPackageVersion(): Promise<string> {
  const packageJson = await Bun.file(resolve(PACKAGE_ROOT, "package.json")).json() as { version?: unknown };
  if (typeof packageJson.version !== "string" || packageJson.version.length === 0) {
    throw new Error("package.json must contain a string version field");
  }

  return packageJson.version;
}

function resolveConfigSource(
  defaultRelativePath: string,
  overridePath: string | undefined,
  flag: string,
  packageVersion: string,
): ConfigSource {
  const path = overridePath
    ? resolveUserPath(overridePath)
    : resolve(PACKAGE_ROOT, defaultRelativePath);

  return {
    kind: overridePath ? "custom" : "default",
    flag,
    path,
    defaultRelativePath,
    releaseUrl: `https://github.com/evgenest/ai-agents-arsenal/blob/v${packageVersion}/${defaultRelativePath.replace(/\\/g, "/")}`,
  };
}

function resolveUserPath(filePath: string): string {
  return isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
}

async function importConfigModule(filePath: string, configName: string): Promise<RuntimeConfigModule> {
  try {
    return await import(pathToFileURL(filePath).href) as RuntimeConfigModule;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load ${configName} config from ${filePath}: ${message}`);
  }
}

function parseAgentsConfig(value: unknown, filePath: string): AgentConfigEntry[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected agentsConfig export in ${filePath} to be an array`);
  }

  return value.map((entry, index) => {
    const configEntry = expectObject(entry, `agentsConfig[${index}]`, filePath);
    const { id, enabled, mcpTargets } = configEntry;

    if (typeof id !== "string" || id.length === 0) {
      throw new Error(`Expected agentsConfig[${index}].id in ${filePath} to be a non-empty string`);
    }
    if (typeof enabled !== "boolean") {
      throw new Error(`Expected agentsConfig[${index}].enabled in ${filePath} to be a boolean`);
    }
    if (!Array.isArray(mcpTargets) || mcpTargets.some((target) => typeof target !== "string" || target.length === 0)) {
      throw new Error(`Expected agentsConfig[${index}].mcpTargets in ${filePath} to be a string array`);
    }

    return { id, enabled, mcpTargets: [...mcpTargets] };
  });
}

function parseSkillsConfig(value: unknown, filePath: string): SkillsConfigEntry[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected skillsConfig export in ${filePath} to be an array`);
  }

  return value.map((entry, index) => {
    const configEntry = expectObject(entry, `skillsConfig[${index}]`, filePath);
    const { repo, skills } = configEntry;

    if (typeof repo !== "string" || repo.length === 0) {
      throw new Error(`Expected skillsConfig[${index}].repo in ${filePath} to be a non-empty string`);
    }
    if (!Array.isArray(skills) || skills.some((skill) => typeof skill !== "string" || skill.length === 0)) {
      throw new Error(`Expected skillsConfig[${index}].skills in ${filePath} to be a string array`);
    }

    return { repo, skills: [...skills] };
  });
}

function parseMcpServers(value: unknown, filePath: string): Record<string, McpServer> {
  const servers = expectObject(value, "mcpServers", filePath);

  for (const [name, server] of Object.entries(servers)) {
    const serverConfig = expectObject(server, `mcpServers.${name}`, filePath);

    if (serverConfig.type === "http") {
      if (typeof serverConfig.url !== "string" || serverConfig.url.length === 0) {
        throw new Error(`Expected mcpServers.${name}.url in ${filePath} to be a non-empty string`);
      }
      expectOptionalStringRecord(serverConfig.headers, `mcpServers.${name}.headers`, filePath);
      expectOptionalStringArray(serverConfig.tools, `mcpServers.${name}.tools`, filePath);
      continue;
    }

    if (typeof serverConfig.command !== "string" || serverConfig.command.length === 0) {
      throw new Error(`Expected mcpServers.${name}.command in ${filePath} to be a non-empty string`);
    }
    expectOptionalStringArray(serverConfig.args, `mcpServers.${name}.args`, filePath);
    expectOptionalStringRecord(serverConfig.env, `mcpServers.${name}.env`, filePath);
    expectOptionalStringArray(serverConfig.tools, `mcpServers.${name}.tools`, filePath);
  }

  return servers as Record<string, McpServer>;
}

function expectObject(value: unknown, name: string, filePath: string): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error(`Expected ${name} in ${filePath} to be an object`);
  }

  return value;
}

function expectOptionalStringArray(value: unknown, name: string, filePath: string) {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`Expected ${name} in ${filePath} to be a string array`);
  }
}

function expectOptionalStringRecord(value: unknown, name: string, filePath: string) {
  if (value === undefined) {
    return;
  }

  const record = expectObject(value, name, filePath);
  if (Object.values(record).some((entry) => typeof entry !== "string")) {
    throw new Error(`Expected ${name} in ${filePath} to contain only string values`);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
