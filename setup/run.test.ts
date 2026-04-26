import { describe, expect, test } from "bun:test";
import { resolveSetupSelection } from "./run";

describe("resolveSetupSelection", () => {
  test("runs both phases with global skills by default", () => {
    expect(resolveSetupSelection([])).toEqual({
      runSkills: true,
      runMcp: true,
      skillsInstallScope: "global",
    });
  });

  test("supports project-local skill installation when selecting skills", () => {
    expect(resolveSetupSelection(["--skills", "--project"])).toEqual({
      runSkills: true,
      runMcp: false,
      skillsInstallScope: "project",
    });
  });

  test("throws on unknown arguments", () => {
    expect(() => resolveSetupSelection(["--wat"])).toThrow("Unknown argument: --wat");
  });
});
