import { describe, expect, test } from "bun:test";
import { resolveSetupSelection } from "./run";

describe("resolveSetupSelection", () => {
  test("runs both phases with global skills by default", () => {
    expect(resolveSetupSelection([])).toEqual({
      runSkills: true,
      runMcp: true,
      skillsInstallScope: "global",
      configPaths: {},
    });
  });

  test("supports project-local skill installation when selecting skills", () => {
    expect(resolveSetupSelection(["--skills", "--project"])).toEqual({
      runSkills: true,
      runMcp: false,
      skillsInstallScope: "project",
      configPaths: {},
    });
  });

  test("supports custom config file flags", () => {
    expect(resolveSetupSelection([
      "--mcp",
      "--agents-config",
      "./configs/agents.local.ts",
      "--mcp-config=./configs/mcp.local.ts",
    ])).toEqual({
      runSkills: false,
      runMcp: true,
      skillsInstallScope: "global",
      configPaths: {
        agentsConfigPath: "./configs/agents.local.ts",
        mcpConfigPath: "./configs/mcp.local.ts",
      },
    });
  });

  test("throws when a config flag is missing its value", () => {
    expect(() => resolveSetupSelection(["--skills-config"])).toThrow("Missing value for --skills-config");
  });

  test("throws on unknown arguments", () => {
    expect(() => resolveSetupSelection(["--wat"])).toThrow("Unknown argument: --wat");
  });
});
