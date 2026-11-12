export const skillsConfig = [
  {
    repo: "better-auth/better-icons",
    skills: ["better-icons"],
  },
  {
    repo: "obra/superpowers",
    skills: [
      "brainstorming",
      "dispatching-parallel-agents",
      "executing-plans",
      "finishing-a-development-branch",
      "receiving-code-review",
      "requesting-code-review",
      "subagent-driven-development",
      "systematic-debugging",
      "test-driven-development",
      "using-superpowers",
      "verification-before-completion",
      "writing-plans",
      "writing-skills",
    ],
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
    skills: ["frontend-design", "pdf", "skill-creator"],
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
    skills: [
      "agents-sdk",
      "cloudflare",
      "cloudflare-email-service",
      "durable-objects",
      // Was `sandbox-sdk`, which upstream split into sandbox-stable (the
      // default npm tag) and sandbox-next (the 1.0 preview). Tracking the
      // stable one; add sandbox-next alongside it when moving to 1.0.
      "sandbox-stable",
      "turnstile-spin",
      "web-perf",
      "workers-best-practices",
      "wrangler",
    ],
  },
  {
    repo: "evgenest/safe-release",
    skills: ["safe-release"],
  },
  {
    repo: "vercel/ai-elements",
    skills: ["ai-elements"],
  },
  {
    repo: "vercel/ai",
    skills: ["ai-sdk", "migrate-ai-sdk-v6-to-v7"],
  },
  {
    repo: "better-auth/skills",
    skills: [
      "better-auth-best-practices",
      "create-auth",
      "email-and-password-best-practices",
      "organization-best-practices",
      "two-factor-authentication-best-practices",
    ],
  },
  {
    repo: "vercel/chat",
    skills: ["chat-sdk"],
  },
  {
    // Upstream renamed this (stablyai/orca 7f885c1, 2026-11-03): computer-use ->
    // orca-computer-use. The old name is gone from the repo, so `skills update`
    // reports it as deleted and, non-interactively, leaves the stale copy in place.
    repo: "stablyai/orca",
    skills: ["orca-computer-use"],
  },
  {
    repo: "upstash/context7",
    skills: ["context7-mcp"],
  },
  {
    // Upstream renamed several of these (the repo now ships 33 skills under
    // shorter names): convex-migration-helper -> convex-migrate,
    // convex-performance-audit -> convex-optimize, convex-setup-auth ->
    // convex-auth. The old names install nothing — see the note in
    // setup/skills.ts about the CLI silently dropping unknown --skill names.
    repo: "get-convex/agent-skills",
    skills: [
      "convex",
      "convex-auth",
      "convex-create-component",
      "convex-migrate",
      "convex-optimize",
      "convex-quickstart",
    ],
  },
  {
    repo: "nexu-io/open-design",
    skills: ["creative-director"],
  },
  {
    repo: "nousresearch/hermes-agent",
    skills: ["dogfood"],
  },
  {
    repo: "resend/email-best-practices",
    skills: ["email-best-practices"],
  },
  {
    repo: "resend/react-email",
    skills: ["react-email"],
  },
  {
    repo: "resend/design-skills",
    skills: ["resend-design-skills"],
  },
  {
    repo: "blader/humanizer",
    skills: ["humanizer"],
  },
  {
    repo: "seb1n/awesome-ai-agent-skills",
    skills: ["note-taking"],
  },
  {
    repo: "vercel-labs/vercel-plugin",
    skills: ["vercel-agent"],
  },
  {
    // Same repo as the GitHits Claude Code plugin, but a different thing: the
    // plugin (installed via /plugin, sourced from ./plugins/claude) ships
    // `onboarding` and `search` as githits:*, while the repo's top-level
    // skills/ directory carries standalone skills the plugin doesn't include.
    // So this is not a duplicate of the plugin — installing both is correct.
    repo: "githits-com/githits-cli",
    skills: ["githits-mcp"],
  },
];
