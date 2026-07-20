export const skillsConfig = [
  {
    repo: "better-auth/better-icons",
    skills: ["better-icons"],
  },
  {
    repo: "obra/superpowers",
    skills: ["brainstorming"],
  },
  {
    repo: "github/awesome-copilot",
    skills: ["create-agentsmd", "git-commit", "prd"],
  },
  {
    repo: "vercel-labs/skills",
    skills: ["find-skills"],
  },
  {
    repo: "anthropics/skills",
    skills: ["frontend-design", "skill-creator"],
  },
  {
    // Vercel plans to fold these skills into Next.js itself starting at
    // v16.3.0 (not yet released — see
    // https://github.com/vercel-labs/next-skills/blob/40bc043eb34a8fcafa77001bbb44e2f95d93f22f/README.md,
    // pinned to a commit since `main`'s content may change later).
    // Until then, `main` no longer carries a working copy and the `skills`
    // CLI can't be pointed at a specific commit for this repo (it always
    // tries Vercel's hosted skill-download API first, which no longer
    // serves this skill, then falls back to a branch/tag-only git clone).
    // Pin to the last commit where the skill still exists on disk; bump
    // `pin.ref` once 16.3.0 ships and drop the pin entirely once Next.js
    // provides it natively.
    repo: "vercel-labs/next-skills",
    skills: ["next-best-practices"],
    pin: {
      ref: "dc1de9caf7612d73f56a8dec3cb1bd6c9ec096b9",
      path: "skills/next-best-practices",
    },
  },
  {
    repo: "shadcn/ui",
    skills: ["shadcn"],
  },
  {
    repo: "vercel-labs/agent-skills",
    skills: ["vercel-composition-patterns", "vercel-react-best-practices", "web-design-guidelines"],
  },
  {
    repo: "cloudflare/skills",
    skills: ["web-perf", "wrangler"],
  },
  {
    repo: "evgenest/safe-release",
    skills: ["safe-release"],
  },
];
