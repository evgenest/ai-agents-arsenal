import { addFailureFor, addFailureText } from "./skills-add-result";
import { addCaptured, runSkillsCaptured } from "./skills-report-exec";
import { findLockEntry, uncheckableReason, type SkillLock } from "./skills-lock";
import { normalizeRepo, type SkillsReportCollector } from "./skills-report";
import { CANONICAL_STORE_AGENT_ID, verifyInstalled } from "./skills";
import { parseUpdateOutput, type UpdateWarning } from "./skills-update-output";
import { extractErrorDetails } from "./errors";

export type UpdateContext = {
  lockBefore: SkillLock;
  lockPath: string;
  repoOf: Map<string, string>;
  skillsStore: string;
  collector: SkillsReportCollector;
};

/**
 * Splits off the present skills `skills update` cannot check (no lock entry,
 * or no `skillFolderHash`/`skillPath`): the CLI drops or skips those without
 * touching its exit code, so they are reported as failed here — each with
 * the command that makes it trackable again — plus one run-level error.
 * Returns the names that are worth passing to `skills update`.
 */
export function reportUncheckable(toUpdate: string[], ctx: UpdateContext): string[] {
  const checkable: string[] = [];
  const bullets: string[] = [];
  for (const name of toUpdate) {
    const reason = uncheckableReason(findLockEntry(ctx.lockBefore, name));
    if (!reason) {
      checkable.push(name);
      continue;
    }
    const repo = ctx.repoOf.get(name) ?? "";
    bullets.push(`  • ${name} (${reason}) — from ${repo}`);
    ctx.collector.setSkill({
      name,
      repo,
      status: "failed",
      error: `\`skills update\` cannot check ${name} (${reason}), so it was not updated.\n`
        + `Re-add it so the lockfile records a hash: bunx skills add ${repo} --skill ${name} -g -a ${CANONICAL_STORE_AGENT_ID} -y`,
    });
  }
  if (bullets.length > 0) {
    ctx.collector.addError(
      `${bullets.length} installed skill(s) cannot be checked by \`skills update\` and were not updated `
      + `(lockfile: ${ctx.lockPath}):\n${bullets.join("\n")}`,
    );
  }
  return checkable;
}

/** Requested names each warning lists, matched case-insensitively like the CLI's own filter. */
export function skillsNamedInWarnings(warnings: UpdateWarning[], requested: string[]): Map<string, UpdateWarning> {
  const byLower = new Map(requested.map((name) => [name.toLowerCase(), name] as const));
  const named = new Map<string, UpdateWarning>();
  for (const warning of warnings) {
    for (const name of warning.names) {
      const match = byLower.get(name.toLowerCase());
      if (match && !named.has(match)) named.set(match, warning);
    }
  }
  return named;
}

/** `Warning: The following … deleted upstream:` → `The following … deleted upstream`. */
function warningHeadline(warning: UpdateWarning): string {
  return warning.text.split("\n")[0]!.replace(/^Warning:\s*/, "").replace(/:$/, "");
}

/**
 * One batched `skills update` for `toUpdate`, then: failed names retried via
 * `add --json` (recovers the reason), skills from a source that couldn't be
 * checked confirmed by a per-repo re-add, and warning blocks recorded in
 * full with the skills they name marked failed. Returns the names the CLI
 * itself reported as updated.
 */
export async function updateCaptured(toUpdate: string[], ctx: UpdateContext): Promise<Set<string>> {
  const { lockBefore, repoOf, skillsStore, collector } = ctx;
  const result = await runSkillsCaptured(["update", ...toUpdate, "-g", "-y"], collector);
  const parsed = parseUpdateOutput(result.stdout + result.stderr);
  const requested = new Set(toUpdate);
  const reportedUpdated = new Set(parsed.updated.filter((name) => requested.has(name)));

  const failedLines = new Map<string, string>();
  for (const { name, line } of parsed.failed) {
    if (requested.has(name)) failedLines.set(name, line);
    else collector.addError(line);
  }

  // Warning blocks never touch the exit code: keep each in full, fail what they name.
  for (const warning of parsed.warnings) collector.addError(`\`skills update\` warning:\n${warning.text}`);
  const warned = skillsNamedInWarnings(parsed.warnings, toUpdate);
  for (const [name, warning] of warned) {
    if (failedLines.has(name)) continue;
    collector.setSkill({
      name,
      repo: repoOf.get(name) ?? "",
      status: "failed",
      error: `\`skills update\` did not update ${name}. ${warningHeadline(warning)}.\n(The full CLI warning is reported separately.)`,
    });
  }

  // A source that couldn't be checked: every requested skill from it is unconfirmed.
  const unconfirmed = new Map<string, { line: string; names: string[] }>();
  for (const { source, line } of parsed.sourceFailures) {
    collector.addError(line);
    const key = normalizeRepo(source);
    for (const name of toUpdate) {
      if (failedLines.has(name) || warned.has(name)) continue;
      const lockSource = lockBefore[name]?.source;
      const repo = repoOf.get(name) ?? "";
      if ((lockSource && normalizeRepo(lockSource) === key) || normalizeRepo(repo) === key) {
        const group = unconfirmed.get(repo) ?? { line, names: [] };
        group.names.push(name);
        unconfirmed.set(repo, group);
      }
    }
  }
  for (const line of parsed.otherFailures) collector.addError(line);

  if (result.exitCode !== 0 && failedLines.size === 0 && parsed.otherFailures.length === 0) {
    collector.addError(
      `\`skills update\` exited with code ${result.exitCode}:\n${extractErrorDetails(result.stdout + result.stderr) || "(no output)"}`,
    );
  }

  // Failed updates: one `add --json` per name — recovers the reason, and is a retry.
  for (const [name, line] of failedLines) {
    const repo = repoOf.get(name) ?? "";
    const retry = await addCaptured(repo, [name], collector);
    const { installed } = await verifyInstalled([name], skillsStore);
    if (installed.length === 1 && !addFailureFor(name, retry)) {
      reportedUpdated.add(name);
      collector.setSkill({ name, repo, status: "updated", note: `\`skills update\` reported "${line}"; a direct \`skills add\` retry succeeded` });
    } else {
      collector.setSkill({ name, repo, status: "failed", error: `${line}\n\nRetry via \`skills add --json\`:\n${addFailureText(name, retry)}` });
    }
  }

  // Unconfirmed (source check failed): re-add per repo to confirm.
  for (const [repo, { line, names }] of unconfirmed) {
    const retry = await addCaptured(repo, names, collector);
    const { installed } = await verifyInstalled(names, skillsStore);
    for (const name of names) {
      if (installed.includes(name) && !addFailureFor(name, retry)) {
        collector.setSkill({ name, repo, status: "unchanged", note: `${line}; confirmed by re-adding with \`skills add\`` });
      } else {
        collector.setSkill({
          name,
          repo,
          status: "failed",
          error: `${line}\n\nConfirming via \`skills add --json\` failed:\n${addFailureText(name, retry)}`,
        });
      }
    }
  }

  return reportedUpdated;
}
