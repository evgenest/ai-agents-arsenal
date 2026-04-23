import { setupSkills } from "./setup/skills";
import { setupClaudeCodeMcp, setupVscodeMcp } from "./setup/mcp";

await setupSkills();
await setupClaudeCodeMcp();
await setupVscodeMcp(); // writes to %APPDATA%/Code/User/mcp.json — global for all VS Code projects
