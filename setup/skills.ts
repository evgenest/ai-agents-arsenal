import { $ } from "bun";
import { activeAgents } from "../config/agents.config";
import { skillsConfig } from "../config/skills.config";

export async function setupSkills() {
  const agentArgs = activeAgents.flatMap((a) => ["-a", a]);
  for (const entry of skillsConfig) {
    const skillArgs = entry.skills.flatMap((s) => ["--skill", s]);
    await $`bunx skills add ${entry.repo} ${skillArgs} -g ${agentArgs} -y`;
  }
}
