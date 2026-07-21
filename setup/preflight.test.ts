import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { McpServer } from "../config/mcp.config";
import { getMissingMcpEnvVars } from "./preflight";

const mcpServers: Record<string, McpServer> = {
  example: {
    command: "npx",
    args: ["-y", "example-mcp"],
    env: { EXAMPLE_API_KEY: "${EXAMPLE_API_KEY}" },
  },
};

describe("getMissingMcpEnvVars", () => {
  const originalValue = process.env.EXAMPLE_API_KEY;

  beforeEach(() => {
    delete process.env.EXAMPLE_API_KEY;
  });

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.EXAMPLE_API_KEY;
    } else {
      process.env.EXAMPLE_API_KEY = originalValue;
    }
  });

  test("reports env vars referenced in config but unset in the shell", () => {
    expect(getMissingMcpEnvVars(mcpServers)).toEqual(["EXAMPLE_API_KEY"]);
  });

  test("does not report env vars that are set", () => {
    process.env.EXAMPLE_API_KEY = "some-value";
    expect(getMissingMcpEnvVars(mcpServers)).toEqual([]);
  });
});
