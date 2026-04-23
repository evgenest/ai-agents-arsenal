export const agentsConfig = [
  { id: "claude-code",    enabled: true  },
  { id: "github-copilot", enabled: true  },
  { id: "antigravity",    enabled: true  },
  { id: "cursor",         enabled: false },
  { id: "windsurf",       enabled: false },
  { id: "codex",          enabled: false },
  { id: "gemini-cli",     enabled: false },
  { id: "kilo",           enabled: false },
] as const;

export const activeAgents = agentsConfig
  .filter((a) => a.enabled)
  .map((a) => a.id);
