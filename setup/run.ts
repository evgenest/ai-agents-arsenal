import { setupMcp } from "./mcp";
import { setupSkills } from "./skills";

type SetupSelection = {
  runSkills: boolean;
  runMcp: boolean;
};

function printUsage() {
  console.log(`Usage: bun run index.ts [--skills] [--mcp]

With no phase flags, both skills and MCP setup run.

  --skills  Run only skill installation
  --mcp     Run only MCP setup
  --help    Show this help message`);
}

function resolveSetupSelection(args: string[]): SetupSelection {
  let runSkills = false;
  let runMcp = false;

  for (const arg of args) {
    if (arg === "--skills") {
      runSkills = true;
      continue;
    }

    if (arg === "--mcp") {
      runMcp = true;
      continue;
    }

    if (arg === "--") {
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!runSkills && !runMcp) {
    return { runSkills: true, runMcp: true };
  }

  return { runSkills, runMcp };
}

export async function runSetup(argv = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return;
  }

  const { runSkills, runMcp } = resolveSetupSelection([...new Set(argv)]);

  if (runSkills) await setupSkills();
  if (runMcp) await setupMcp();
}