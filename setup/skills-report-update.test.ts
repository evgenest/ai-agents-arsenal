import { describe, expect, test } from "bun:test";
import { SkillsReportCollector } from "./skills-report";
import { reportUncheckable, skillsNamedInWarnings, type UpdateContext } from "./skills-report-update";

describe("reportUncheckable", () => {
  test("fails present skills the CLI can't check and records one run-level error", () => {
    const collector = new SkillsReportCollector();
    const ctx: UpdateContext = {
      lockBefore: {
        tracked: { source: "o/r", skillFolderHash: "h", skillPath: "skills/tracked/SKILL.md" },
        nohash: { source: "o/r", sourceType: "github", skillPath: "skills/nohash/SKILL.md" },
      },
      lockPath: "/home/u/.agents/.skill-lock.json",
      repoOf: new Map([["tracked", "o/r"], ["nohash", "o/r"], ["untracked", "o/s"]]),
      skillsStore: "/home/u/.claude/skills",
      collector,
    };

    expect(reportUncheckable(["tracked", "nohash", "untracked"], ctx)).toEqual(["tracked"]);

    const report = collector.build();
    expect(report.skills.map((s) => [s.name, s.status])).toEqual([["nohash", "failed"], ["untracked", "failed"]]);
    expect(report.skills[1]!.error).toContain("not tracked in the skills CLI lockfile");
    expect(report.skills[1]!.error).toContain("bunx skills add o/s --skill untracked -g -a claude-code -y");
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toContain("2 installed skill(s) cannot be checked by `skills update`");
    expect(report.errors[0]).toContain("• nohash (Private or deleted repo) — from o/r");
    expect(collector.hasFailures()).toBe(true);
  });

  test("nothing to report when every skill is checkable", () => {
    const collector = new SkillsReportCollector();
    const lockBefore = { a: { skillFolderHash: "h", skillPath: "a/SKILL.md" } };
    expect(reportUncheckable(["a"], { lockBefore, lockPath: "/l", repoOf: new Map(), skillsStore: "/s", collector })).toEqual(["a"]);
    expect(collector.hasFailures()).toBe(false);
  });
});

describe("skillsNamedInWarnings", () => {
  test("maps requested names (case-insensitively) to the warning that lists them", () => {
    const deleted = { text: "Warning: … deleted upstream:\n  • Ghost\n  • not-ours", names: ["Ghost", "not-ours"] };
    const named = skillsNamedInWarnings([deleted], ["ghost", "fine"]);
    expect([...named.keys()]).toEqual(["ghost"]);
    expect(named.get("ghost")).toBe(deleted);
  });
});
