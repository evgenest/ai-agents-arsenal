import { describe, expect, test } from "bun:test";
import { addFailureFor, classifyAddedSkill, NOT_INSTALLED_HINT, type AddRun } from "./skills-add-result";
import { parseAddJson } from "./skills-report";

const run = (exitCode: number, items: unknown[] | null, stderr = ""): AddRun => {
  const stdout = items ? JSON.stringify(items) : "";
  return { result: { exitCode, stdout, stderr }, json: parseAddJson(stdout) };
};

describe("addFailureFor", () => {
  test("the per-skill JSON entry decides, even when a sibling fails the exit code", () => {
    const batch = run(1, [
      { name: "ok", status: "installed" },
      { name: "gone", status: "skipped", reason: "No matching skill found in source" },
      { name: "bad", status: "failed", error: "EACCES: permission denied, open '/x/SKILL.md'" },
    ]);
    expect(addFailureFor("ok", batch)).toBeNull();
    expect(addFailureFor("gone", batch)).toBe(`No matching skill found in source\n\n${NOT_INSTALLED_HINT}`);
    expect(addFailureFor("bad", batch)).toBe("EACCES: permission denied, open '/x/SKILL.md'");
  });

  test("a nameless failure or a non-zero exit without JSON fails every name, with the full text", () => {
    expect(addFailureFor("a", run(1, [{ status: "failed", error: "Failed to clone repository" }]))).toBe("Failed to clone repository");
    expect(addFailureFor("a", run(1, null, "error: ConnectionRefused\n  at fetch"))).toBe(
      "`skills add` exited with code 1:\nerror: ConnectionRefused\n  at fetch",
    );
    expect(addFailureFor("a", run(0, null))).toBeNull();
  });
});

describe("classifyAddedSkill", () => {
  const base = { name: "s", skillsStore: "/store", preExisted: false, onDisk: true, failure: null, lockChange: "installed" as const };

  test("a new skill that landed is installed", () => {
    expect(classifyAddedSkill(base)).toEqual({ status: "installed" });
  });

  test("a skill that was already on disk is classified by its lock hash, never installed", () => {
    expect(classifyAddedSkill({ ...base, preExisted: true, lockChange: "unchanged" })).toEqual({ status: "unchanged" });
    expect(classifyAddedSkill({ ...base, preExisted: true, lockChange: "updated" })).toEqual({ status: "updated" });
    expect(classifyAddedSkill({ ...base, preExisted: true, lockChange: "installed" }).status).toBe("updated");
  });

  test("a failed add is failed even though the old copy is still on disk", () => {
    const outcome = classifyAddedSkill({ ...base, preExisted: true, lockChange: "unchanged", failure: "Failed to clone repository" });
    expect(outcome.status).toBe("failed");
    expect(outcome.error).toStartWith("Failed to clone repository");
    expect(outcome.error).toContain("still at /store/s, but it was not refreshed");
  });

  test("nothing on disk after an add that claimed success is a failure", () => {
    expect(classifyAddedSkill({ ...base, onDisk: false })).toEqual({ status: "failed", error: NOT_INSTALLED_HINT });
  });
});
