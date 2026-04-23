import { setupSkills } from "./setup/skills";
import { setupClaudeCodeMcp, setupVscodeMcp } from "./setup/mcp";

await setupSkills();
await setupClaudeCodeMcp();

if (process.argv.includes("--vscode")) {
  await setupVscodeMcp();
}
