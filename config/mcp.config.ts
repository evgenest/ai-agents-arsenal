type McpServerStdio = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  tools?: string[];
};

type McpServerHttp = {
  type: "http";
  url: string;
  headers?: Record<string, string>;
  tools?: string[];
};

export type McpServer = McpServerStdio | McpServerHttp;

// Env var references use Claude Code's ${VAR} syntax.
// The setup script auto-converts these to ${env:VAR} when writing .vscode/mcp.json.
// For npx-based MCP servers, put "-y" first to suppress interactive install prompts.
// Set the following env vars in your system before running:
//   TAVILY_API_KEY, CONTEXT7_API_KEY, EXA_API_KEY, MAGIC_API_KEY
export const mcpServers: Record<string, McpServer> = {
  tavily: {
    command: "npx",
    args: ["-y", "tavily-mcp@0.2.15"],
    env: { TAVILY_API_KEY: "${TAVILY_API_KEY}" },
  },
  context7: {
    command: "npx",
    args: ["-y", "@upstash/context7-mcp@latest"],
    env: { CONTEXT7_API_KEY: "${CONTEXT7_API_KEY}" },
  },
  exa: {
    type: "http",
    url: "https://mcp.exa.ai/mcp",
    headers: { Authorization: "Bearer ${EXA_API_KEY}" },
    tools: ["web_search_exa", "web_fetch_exa"],
  },
  "21st-magic": {
    command: "npx",
    args: ["-y", "@21st-dev/magic@latest", 'API_KEY="${MAGIC_API_KEY}"'],
  },
};
