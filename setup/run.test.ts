import { describe, expect, test } from "bun:test";
import { resolveSetupSelection } from "./run";

describe("resolveSetupSelection", () => {
  test("runs both phases with global skills by default", () => {
    expect(resolveSetupSelection([])).toEqual({
      runSkills: true,
      runMcp: true,
      skillsInstallScope: "global",
      configPaths: {},
      dryRun: false,
    });
  });

  test("supports project-local skill installation when selecting skills", () => {
    expect(resolveSetupSelection(["--skills", "--project"])).toEqual({
      runSkills: true,
      runMcp: false,
      skillsInstallScope: "project",
      configPaths: {},
      dryRun: false,
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
      dryRun: false,
    });
  });

  test("supports --dry-run", () => {
    // runSkills/runMcp stay true here (both phases selected for preview) —
    // dryRun is the separate flag that stops runSetup from acting on them.
    expect(resolveSetupSelection(["--dry-run"])).toEqual({
      runSkills: true,
      runMcp: true,
      skillsInstallScope: "global",
      configPaths: {},
      dryRun: true,
    });
  });

  test("throws when a config flag is missing its value", () => {
    expect(() => resolveSetupSelection(["--skills-config"])).toThrow("Missing value for --skills-config");
  });

  test("throws on unknown arguments", () => {
    expect(() => resolveSetupSelection(["--wat"])).toThrow("Unknown argument: --wat");
  });
});

describe("--report", () => {
  test("accepts --report <path> and --report=<path> with --skills", () => {
    expect(resolveSetupSelection(["--skills", "--report", "/tmp/r.json"])).toEqual({
      runSkills: true,
      runMcp: false,
      skillsInstallScope: "global",
      configPaths: {},
      dryRun: false,
      reportPath: "/tmp/r.json",
    });
    expect(resolveSetupSelection(["--skills", "--report=/tmp/r.json"]).reportPath).toBe("/tmp/r.json");
  });

  test("throws when the value is missing", () => {
    expect(() => resolveSetupSelection(["--skills", "--report"])).toThrow("Missing value for --report");
    expect(() => resolveSetupSelection(["--skills", "--report="])).toThrow("Missing value for --report");
    expect(() => resolveSetupSelection(["--report", "--skills"])).toThrow("Missing value for --report");
  });

  test("only applies to an actual global skills run", () => {
    expect(() => resolveSetupSelection(["--report", "r.json"])).toThrow("--report requires --skills");
    expect(() => resolveSetupSelection(["--skills", "--mcp", "--report", "r.json"])).toThrow("--report requires --skills");
    expect(() => resolveSetupSelection(["--skills", "--project", "--report", "r.json"])).toThrow("--project");
    expect(() => resolveSetupSelection(["--skills", "--dry-run", "--report", "r.json"])).toThrow("--dry-run");
  });
});
