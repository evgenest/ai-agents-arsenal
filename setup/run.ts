import { loadSetupConfig, type ConfigPathOverrides } from "./config";
import { setupMcp } from "./mcp";
import { printSetupPreview } from "./preflight";
import { setupSkills, type SkillsInstallScope } from "./skills";

export type SetupSelection = {
  // Which phases were requested — drives what printSetupPreview shows, not
  // whether anything actually runs. That's dryRun's job, checked separately
  // in runSetup after the preview is printed.
  runSkills: boolean;
  runMcp: boolean;
  skillsInstallScope: SkillsInstallScope;
  configPaths: ConfigPathOverrides;
  dryRun: boolean;
};

function printUsage() {
  console.log(`Usage:
  bun run index.ts [--skills] [--mcp] [--project] [--agents-config <path>] [--skills-config <path>] [--mcp-config <path>]
  bunx @evgenest/ai-agents-arsenal [--skills] [--mcp] [--project] [--agents-config <path>] [--skills-config <path>] [--mcp-config <path>]

With no phase flags, both skills and MCP setup run.

  --skills  Run only skill installation
  --mcp     Run only MCP setup
  --project Install skills into the current project instead of globally
  --dry-run Print the setup preview and exit without making changes
  --agents-config Override config/agents.config.ts with a custom file
  --skills-config Override config/skills.config.ts with a custom file
  --mcp-config Override config/mcp.config.ts with a custom file
  --help    Show this help message`);
}

export function resolveSetupSelection(args: string[]): SetupSelection {
  let runSkills = false;
  let runMcp = false;
  let skillsInstallScope: SkillsInstallScope = "global";
  let dryRun = false;
  const configPaths: ConfigPathOverrides = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;

    if (arg === "--skills") {
      runSkills = true;
      continue;
    }

    if (arg === "--mcp") {
      runMcp = true;
      continue;
    }

    if (arg === "--project") {
      skillsInstallScope = "project";
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg.startsWith("--agents-config=")) {
      configPaths.agentsConfigPath = readInlineFlagValue(arg, "--agents-config");
      continue;
    }

    if (arg.startsWith("--skills-config=")) {
      configPaths.skillsConfigPath = readInlineFlagValue(arg, "--skills-config");
      continue;
    }

    if (arg.startsWith("--mcp-config=")) {
      configPaths.mcpConfigPath = readInlineFlagValue(arg, "--mcp-config");
      continue;
    }

    if (arg === "--agents-config") {
      configPaths.agentsConfigPath = readNextFlagValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--skills-config") {
      configPaths.skillsConfigPath = readNextFlagValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--mcp-config") {
      configPaths.mcpConfigPath = readNextFlagValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--") {
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!runSkills && !runMcp) {
    return { runSkills: true, runMcp: true, skillsInstallScope, configPaths, dryRun };
  }

  return { runSkills, runMcp, skillsInstallScope, configPaths, dryRun };
}

export async function runSetup(argv = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return;
  }

  const { runSkills, runMcp, skillsInstallScope, configPaths, dryRun } = resolveSetupSelection(argv);
  const config = await loadSetupConfig(configPaths);

  printSetupPreview({ runSkills, runMcp, skillsInstallScope }, config);

  if (dryRun) {
    console.log("\nDry run: no changes made.");
    return;
  }

  if (runSkills) await setupSkills(config.agentsConfig, config.skillsConfig, skillsInstallScope);
  if (runMcp) await setupMcp(config.activeMcpTargets, config.mcpServers);
}

function readInlineFlagValue(argument: string, flag: string): string {
  const value = argument.slice(flag.length + 1);
  if (value.length === 0) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

function readNextFlagValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value === "--" || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}
