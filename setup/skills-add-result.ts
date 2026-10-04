import { join } from "node:path";
import { extractErrorDetails } from "./errors";
import type { LockChange } from "./skills-lock";
import type { AddJsonResult, SkillReportEntry } from "./skills-report";

/** A captured child process. exitCode -1 means it could not be started at all. */
export type Captured = { exitCode: number; stdout: string; stderr: string };

export type AddRun = { result: Captured; json: AddJsonResult | null };

export const NOT_INSTALLED_HINT = "`skills add` put nothing on disk for this name.\n"
  + "The source repo doesn't carry it under that name — upstream most likely\n"
  + "renamed or removed it. Check the repo's current skill list and update\n"
  + "config/skills.config.ts.";

/** Best reason a name didn't install: the CLI's own per-skill JSON message, else its output. */
export function addFailureText(name: string, { result, json }: AddRun): string {
  const perSkill = json?.bySkill.get(name);
  if (perSkill?.error) {
    return perSkill.status === "skipped" ? `${perSkill.error}\n\n${NOT_INSTALLED_HINT}` : perSkill.error;
  }
  const general = json?.general.join("\n");
  if (general) return general;
  if (result.exitCode !== 0) {
    return `\`skills add\` exited with code ${result.exitCode}:\n${extractErrorDetails(result.stderr + result.stdout) || "(no output)"}`;
  }
  return NOT_INSTALLED_HINT;
}

/**
 * Whether `skills add --json` failed for this name, as the full reason, or
 * null if it succeeded. The CLI's per-skill entry decides when there is one
 * (one bad name in a batch sets exit 1 for all of them); otherwise a
 * non-zero exit fails every name in the call.
 */
export function addFailureFor(name: string, run: AddRun): string | null {
  const perSkill = run.json?.bySkill.get(name);
  if (perSkill) return perSkill.status === "installed" ? null : addFailureText(name, run);
  return run.result.exitCode === 0 ? null : addFailureText(name, run);
}

export type AddedSkillFacts = {
  name: string;
  skillsStore: string;
  /** `<store>/<name>/SKILL.md` existed before `skills add` ran. */
  preExisted: boolean;
  /** …and exists after it. */
  onDisk: boolean;
  /** addFailureFor() for this name. */
  failure: string | null;
  /** diffLockEntry() before → after the add. */
  lockChange: LockChange;
};

/**
 * Status of a skill that went through `skills add`. Normally those are
 * missing skills, but when `skills list` fails every skill lands here, so a
 * name already on disk is classified by its lockfile hash like an update —
 * never "installed" — and a failed add stays "failed" even though the old
 * copy is still there.
 */
export function classifyAddedSkill(facts: AddedSkillFacts): Pick<SkillReportEntry, "status" | "error" | "note"> {
  const { name, skillsStore, preExisted, onDisk, failure, lockChange } = facts;
  if (failure) {
    const kept = preExisted && onDisk
      ? `\n\nThe copy that was already installed is still at ${join(skillsStore, name)}, but it was not refreshed.`
      : "";
    return { status: "failed", error: `${failure}${kept}` };
  }
  if (!onDisk) return { status: "failed", error: NOT_INSTALLED_HINT };
  if (!preExisted) return { status: "installed" };
  if (lockChange === "updated") return { status: "updated" };
  if (lockChange === "installed") {
    return { status: "updated", note: "was on disk without a skills CLI lockfile entry; re-added, so it is tracked now" };
  }
  if (lockChange === "absent") {
    return { status: "unchanged", note: "re-added, but the skills CLI lockfile still has no entry for it" };
  }
  return { status: "unchanged" };
}
