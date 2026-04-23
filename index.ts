import { $ } from "bun";

await $`bunx skills add better-auth/better-icons --skill better-icons                                                                                  -g -a claude-code -y`;
await $`bunx skills add obra/superpowers         --skill brainstorming                                                                                 -g -a claude-code -y`;
await $`bunx skills add github/awesome-copilot   --skill create-agentsmd             --skill git-commit                  --skill prd                   -g -a claude-code -y`;
await $`bunx skills add vercel-labs/skills       --skill find-skills                                                                                   -g -a claude-code -y`;
await $`bunx skills add anthropics/skills        --skill frontend-design             --skill skill-creator                                             -g -a claude-code -y`;
await $`bunx skills add vercel-labs/next-skills  --skill next-best-practices                                                                           -g -a claude-code -y`;
await $`bunx skills add shadcn/ui                --skill shadcn                                                                                        -g -a claude-code -y`;
await $`bunx skills add vercel-labs/agent-skills --skill vercel-composition-patterns --skill vercel-react-best-practices --skill web-design-guidelines -g -a claude-code -y`;

