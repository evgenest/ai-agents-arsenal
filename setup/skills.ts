import { $ } from "bun";
import type { SkillsConfigEntry } from "./config";

export type SkillsInstallScope = "global" | "project";

export async function setupSkills(
  activeAgents: string[],
  skillsConfig: SkillsConfigEntry[],
  scope: SkillsInstallScope = "global",
) {
  const agentArgs = activeAgents.flatMap((a) => ["-a", a]);
  const globalFlag = scope === "global" ? ["-g"] : [];
  for (const entry of skillsConfig) {
    const skillArgs = entry.skills.flatMap((s) => ["--skill", s]);
    await $`bunx skills add ${entry.repo} ${skillArgs} ${globalFlag} ${agentArgs} -y`;
  }
}
