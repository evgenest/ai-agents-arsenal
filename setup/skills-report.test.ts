import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeRepo, parseAddJson, runWithReport, SkillsReportCollector, type SkillsReport } from "./skills-report";

const TEXT = "\u001b[38;5;145m";
const RESET = "\u001b[0m";

describe("normalizeRepo", () => {
  test("treats GitHub URL forms as the same repo", () => {
    expect(normalizeRepo("https://github.com/Obra/Superpowers.git")).toBe("obra/superpowers");
    expect(normalizeRepo("git@github.com:obra/superpowers.git")).toBe("obra/superpowers");
    expect(normalizeRepo("obra/superpowers/")).toBe("obra/superpowers");
  });
});

describe("parseAddJson", () => {
  test("reads per-skill statuses and nameless failures", () => {
    const parsed = parseAddJson(JSON.stringify([
      { name: "ok", status: "installed", hash: "h" },
      { name: "gone", status: "skipped", reason: "No matching skill found in source" },
      { status: "failed", error: "Failed to clone repository" },
    ]));
    expect(parsed?.bySkill.get("ok")).toEqual({ status: "installed" });
    expect(parsed?.bySkill.get("gone")).toEqual({ status: "skipped", error: "No matching skill found in source" });
    expect(parsed?.general).toEqual(["Failed to clone repository"]);
  });

  test("returns null for non-JSON output", () => {
    expect(parseAddJson("Installation failed")).toBeNull();
  });
});

describe("runWithReport", () => {
  let dir = "";
  const originalExitCode = process.exitCode;

  afterEach(async () => {
    process.exitCode = originalExitCode ?? 0;
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  test("writes the report even when the body throws, and fails the exit code", async () => {
    dir = await mkdtemp(join(tmpdir(), "arsenal-report-"));
    const path = join(dir, "nested", "report.json");
    const collector = new SkillsReportCollector();
    const logged: string[] = [];

    await runWithReport(path, collector, async () => {
      collector.setSkill({ name: "a", repo: "o/r", status: "updated", oldHash: "1", newHash: "2" });
      collector.appendTranscript("bunx skills update a -g -y", `${TEXT}✓${RESET} Updated a\n`, 0);
      throw new Error("boom");
    }, { log: (line) => logged.push(line) });

    const report = JSON.parse(await readFile(path, "utf-8")) as SkillsReport;
    expect(report.version).toBe(1);
    expect(report.skills).toEqual([{ name: "a", repo: "o/r", status: "updated", oldHash: "1", newHash: "2" }]);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toContain("boom");
    expect(report.transcript).toBe("$ bunx skills update a -g -y  [exit 0]\n✓ Updated a");
    expect(process.exitCode).toBe(1);
    expect(logged).toEqual([`skills: 1 updated, 1 error(s) → report: ${path}`]);
  });

  test("a clean run leaves the exit code alone", async () => {
    dir = await mkdtemp(join(tmpdir(), "arsenal-report-"));
    const path = join(dir, "report.json");
    const collector = new SkillsReportCollector();
    process.exitCode = 0;

    await runWithReport(path, collector, async () => {
      collector.setSkill({ name: "a", repo: "o/r", status: "unchanged" });
    }, { log: () => {} });

    expect(process.exitCode).toBe(0);
    expect((JSON.parse(await readFile(path, "utf-8")) as SkillsReport).errors).toEqual([]);
  });

  test("a failed skill fails the exit code", async () => {
    dir = await mkdtemp(join(tmpdir(), "arsenal-report-"));
    const collector = new SkillsReportCollector();
    process.exitCode = 0;

    await runWithReport(join(dir, "r.json"), collector, async () => {
      collector.setSkill({ name: "a", repo: "o/r", status: "failed", error: "nope" });
    }, { log: () => {} });

    expect(process.exitCode).toBe(1);
  });

  test("an unwritable report path fails the exit code instead of passing silently", async () => {
    const errors: string[] = [];
    process.exitCode = 0;

    await runWithReport("/report.json", new SkillsReportCollector(), async () => {}, {
      log: () => {},
      logError: (line) => errors.push(line),
      write: async () => {
        throw new Error("EACCES: permission denied");
      },
    });

    expect(process.exitCode).toBe(1);
    expect(errors[0]).toContain("EACCES");
  });
});
