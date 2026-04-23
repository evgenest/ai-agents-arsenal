import { $ } from "bun";
import { skillsConfig } from "./skills.config";

for (const entry of skillsConfig) {
  const skillArgs = entry.skills.flatMap((s) => ["--skill", s]);
  await $`bunx skills add ${entry.repo} ${skillArgs} -g -a claude-code -y`;
}
