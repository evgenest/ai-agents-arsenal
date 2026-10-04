import { describe, expect, test } from "bun:test";
import { checkSkillsCliMajor, describeSkillsCliRefresh, TESTED_SKILLS_CLI_MAJOR, type SkillsCliRefresh } from "./skills-cli";

const base: SkillsCliRefresh = { before: "1.7.0", after: "1.7.0", error: null, command: "bun update -g skills", output: "" };

describe("describeSkillsCliRefresh", () => {
  test("says up to date only when the version did not move", () => {
    expect(describeSkillsCliRefresh(base).lines).toEqual(["  ✓ Global `skills` CLI is up to date (v1.7.0)"]);
    expect(describeSkillsCliRefresh({ ...base, after: "1.8.0" }).lines).toEqual(["  ✓ Updated global `skills` CLI v1.7.0 → v1.8.0"]);
  });

  test("reports a failure as a warning instead of swallowing it", () => {
    const { lines, warnings } = describeSkillsCliRefresh({ ...base, error: "`bun update -g skills` exited with code 1:\nerror: ConnectionRefused" });
    expect(lines).toEqual([]);
    expect(warnings[0]).toContain("Could not refresh the global `skills` CLI");
    expect(warnings.join("\n")).toContain("error: ConnectionRefused");
  });
});

describe("checkSkillsCliMajor", () => {
  test("is quiet for the tested major or an unknown version", () => {
    expect(checkSkillsCliMajor({ before: "1.7.0", after: "1.9.3" }, "6.3.0", 1)).toBeNull();
    expect(checkSkillsCliMajor({ before: null, after: null }, "6.3.0", 1)).toBeNull();
  });

  test("flags a different major, preferring the version after the refresh", () => {
    expect(checkSkillsCliMajor({ before: "1.7.0", after: "2.0.1" }, "6.3.0", 1)).toBe(
      "skills CLI v2.0.1 is untested with ai-agents-arsenal 6.3.0 (verified with 1.x) — "
      + "check that skills still update correctly, then bump TESTED_SKILLS_CLI_MAJOR",
    );
    expect(checkSkillsCliMajor({ before: "2.0.0", after: null }, "6.3.0", 1)).toContain("skills CLI v2.0.0 is untested");
  });

  test("defaults to TESTED_SKILLS_CLI_MAJOR", () => {
    expect(checkSkillsCliMajor({ before: null, after: `${TESTED_SKILLS_CLI_MAJOR}.0.0` }, "6.3.0")).toBeNull();
    expect(checkSkillsCliMajor({ before: null, after: `${TESTED_SKILLS_CLI_MAJOR + 1}.0.0` }, "6.3.0")).not.toBeNull();
  });
});
