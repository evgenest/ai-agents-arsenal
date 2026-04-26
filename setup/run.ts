import { setupMcp } from "./mcp";
import { setupSkills, type SkillsInstallScope } from "./skills";

type SetupSelection = {
  runSkills: boolean;
  runMcp: boolean;
  skillsInstallScope: SkillsInstallScope;
};

function printUsage() {
  console.log(`Usage: bun run index.ts [--skills] [--mcp] [--project]

With no phase flags, both skills and MCP setup run.

  --skills  Run only skill installation
  --mcp     Run only MCP setup
  --project Install skills into the current project instead of globally
  --help    Show this help message`);
}

function resolveSetupSelection(args: string[]): SetupSelection {
  let runSkills = false;
  let runMcp = false;
  let skillsInstallScope: SkillsInstallScope = "global";

  for (const arg of args) {
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

    if (arg === "--") {
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!runSkills && !runMcp) {
    return { runSkills: true, runMcp: true, skillsInstallScope };
  }

  return { runSkills, runMcp, skillsInstallScope };
}

export async function runSetup(argv = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return;
  }

  const { runSkills, runMcp, skillsInstallScope } = resolveSetupSelection([...new Set(argv)]);

  if (runSkills) await setupSkills(skillsInstallScope);
  if (runMcp) await setupMcp();
}