import { loadSetupConfig, type ConfigPathOverrides } from "./config";
import { setupMcp } from "./mcp";
import { printMissingMcpEnvVarsSummary, printSetupPreview } from "./preflight";
import { setupSkills, type SkillsInstallScope } from "./skills";
import { runWithReport, SkillsReportCollector } from "./skills-report";
import { setupGlobalSkillsWithReport } from "./skills-report-run";

export type SetupSelection = {
  // Which phases were requested — drives what printSetupPreview shows, not
  // whether anything actually runs. That's dryRun's job, checked separately
  // in runSetup after the preview is printed.
  runSkills: boolean;
  runMcp: boolean;
  skillsInstallScope: SkillsInstallScope;
  configPaths: ConfigPathOverrides;
  dryRun: boolean;
  /**
   * `--report <path>`: run the global skills phase quietly and write a JSON
   * report there (see setup/skills-report.ts). Set only when the flag is given.
   */
  reportPath?: string;
};

function printUsage() {
  console.log(`Usage:
  bun run index.ts [--skills] [--mcp] [--project] [--agents-config <path>] [--skills-config <path>] [--mcp-config <path>]
  bunx @evgenest/ai-agents-arsenal [--skills] [--mcp] [--project] [--agents-config <path>] [--skills-config <path>] [--mcp-config <path>]
  bunx @evgenest/ai-agents-arsenal --skills --report <path> [--agents-config <path>] [--skills-config <path>]

With no phase flags, both skills and MCP setup run.

  --skills  Run only skill installation
  --mcp     Run only MCP setup
  --project Install skills into the current project instead of globally
  --dry-run Print the setup preview and exit without making changes
  --agents-config Override config/agents.config.ts with a custom file
  --skills-config Override config/skills.config.ts with a custom file
  --mcp-config Override config/mcp.config.ts with a custom file
  --report <path> With --skills (global scope only): skip the preview and per-skill
            output, write a JSON report of what was updated/installed/failed to
            <path>, print one summary line, exit 1 if anything failed
  --help    Show this help message`);
}

export function resolveSetupSelection(args: string[]): SetupSelection {
  let runSkills = false;
  let runMcp = false;
  let skillsInstallScope: SkillsInstallScope = "global";
  let dryRun = false;
  let reportPath: string | undefined;
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

    if (arg.startsWith("--report=")) {
      reportPath = readInlineFlagValue(arg, "--report");
      continue;
    }

    if (arg === "--report") {
      reportPath = readNextFlagValue(args, index, arg);
      index += 1;
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

  if (reportPath !== undefined) {
    validateReportSelection({ runSkills, runMcp, skillsInstallScope, dryRun });
    return { runSkills, runMcp, skillsInstallScope, configPaths, dryRun, reportPath };
  }

  if (!runSkills && !runMcp) {
    return { runSkills: true, runMcp: true, skillsInstallScope, configPaths, dryRun };
  }

  return { runSkills, runMcp, skillsInstallScope, configPaths, dryRun };
}

/** `--report` describes one specific run: the global skills phase, actually executed. */
function validateReportSelection(selection: Omit<SetupSelection, "configPaths" | "reportPath">) {
  if (!selection.runSkills || selection.runMcp) {
    throw new Error("--report requires --skills and cannot be combined with --mcp (it reports on the skills phase only)");
  }
  if (selection.skillsInstallScope === "project") {
    throw new Error("--report supports global skill installs only and cannot be combined with --project");
  }
  if (selection.dryRun) {
    throw new Error("--report cannot be combined with --dry-run (there is nothing to report without a run)");
  }
}

export async function runSetup(argv = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return;
  }

  const { runSkills, runMcp, skillsInstallScope, configPaths, dryRun, reportPath } = resolveSetupSelection(argv);

  if (reportPath !== undefined) {
    // No preview and no per-skill console output: everything goes into the
    // report, which is written even if config loading or setup throws.
    const collector = new SkillsReportCollector();
    await runWithReport(reportPath, collector, async () => {
      const config = await loadSetupConfig(configPaths);
      await setupGlobalSkillsWithReport(config.agentsConfig, config.skillsConfig, collector, config.packageVersion);
    });
    return;
  }

  const config = await loadSetupConfig(configPaths);

  printSetupPreview({ runSkills, runMcp, skillsInstallScope }, config);

  if (dryRun) {
    if (runMcp) printMissingMcpEnvVarsSummary(config.mcpServers, config.activeMcpTargets);
    console.log("\nDry run: no changes made.");
    return;
  }

  if (runSkills) await setupSkills(config.agentsConfig, config.skillsConfig, skillsInstallScope);
  if (runMcp) {
    await setupMcp(config.activeMcpTargets, config.mcpServers);
    printMissingMcpEnvVarsSummary(config.mcpServers, config.activeMcpTargets);
  }
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
