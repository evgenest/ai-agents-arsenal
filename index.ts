import { setupMcp } from "./setup/mcp";
import { setupSkills } from "./setup/skills";

await setupSkills();
await setupMcp();
