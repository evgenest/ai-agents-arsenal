import { $ } from "bun";
import { activeAgents } from "../config/agents.config";
import { skillsConfig } from "../config/skills.config";

export type SkillsInstallScope = "global" | "project";

export async function setupSkills(scope: SkillsInstallScope = "global") {
  const agentArgs = activeAgents.flatMap((a) => ["-a", a]);
  const globalFlag = scope === "global" ? ["-g"] : [];
  for (const entry of skillsConfig) {
    const skillArgs = entry.skills.flatMap((s) => ["--skill", s]);
    await $`bunx skills add ${entry.repo} ${skillArgs} ${globalFlag} ${agentArgs} -y`;
  }
}
