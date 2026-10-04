import { join } from "node:path";
import type { AgentConfigEntry, SkillsConfigEntry } from "./config";
import { describeError } from "./errors";
import {
  CANONICAL_STORE_AGENT_ID,
  createSkillSymlinks,
  installPinnedSkill,
  pathExists,
  planGlobalSkills,
  resolveCanonicalStore,
  verifyInstalled,
} from "./skills";
import { addFailureFor, classifyAddedSkill } from "./skills-add-result";
import { checkSkillsCliMajor, refreshGlobalSkillsCli } from "./skills-cli";
import { diffLockEntry, lockHash, readSkillLock, skillLockPath, type SkillLock } from "./skills-lock";
import type { SkillReportEntry, SkillsReportCollector } from "./skills-report";
import { addCaptured, listInstalled } from "./skills-report-exec";
import { reportUncheckable, updateCaptured, type UpdateContext } from "./skills-report-update";

/**
 * `--report` counterpart of setupGlobalSkills (setup/skills.ts): same plan —
 * `skills list` → `add` for missing, one batched `update` for present,
 * pins, symlinks — but every child runs captured, nothing goes to the
 * console, and each skill ends up with an exact status in the collector.
 *
 * "updated" vs "unchanged" comes from diffing the `skills` CLI's own
 * lockfile (`skillFolderHash`) before and after, not from its output.
 * `skills update` re-installs changed skills with their output discarded,
 * so a failed one leaves only `✗ Failed to update <name>`; to recover the
 * actual reason, each such skill is re-added once with `--json`, which
 * doubles as a retry.
 */
export async function setupGlobalSkillsWithReport(
  agentsConfig: AgentConfigEntry[],
  skillsConfig: SkillsConfigEntry[],
  collector: SkillsReportCollector,
  arsenalVersion: string,
): Promise<void> {
  const refresh = await refreshGlobalSkillsCli();
  collector.cli = { before: refresh.before, after: refresh.after, error: refresh.error };
  collector.appendTranscript(refresh.command, refresh.output);
  const untested = checkSkillsCliMajor(refresh, arsenalVersion);
  if (untested) collector.addError(untested);

  const skillsStore = resolveCanonicalStore(agentsConfig);
  const lockPath = skillLockPath();
  const lockBefore = await readSkillLock(lockPath);

  const installed = await listInstalled(collector);
  const plan = planGlobalSkills(skillsConfig, installed);
  const { pinnedEntries } = plan;
  const repoOf = new Map(skillsConfig.flatMap((e) => e.skills.map((s) => [s, e.repo] as const)));

  // `skills list` also sees copies outside the canonical store (~/.agents/skills,
  // other agents' dirs). `skills update` never puts a skill back into the store,
  // so one that is listed but missing there has to go through `skills add`.
  const { missing: notInStore } = await verifyInstalled(plan.toUpdate, skillsStore);
  const toUpdate = plan.toUpdate.filter((name) => !notInStore.includes(name));
  const toAdd = plan.toAdd.map((e) => ({ ...e, skills: [...e.skills] }));
  for (const name of notInStore) {
    const repo = repoOf.get(name) ?? "";
    const entry = toAdd.find((e) => e.repo === repo);
    if (entry) entry.skills.push(name);
    else toAdd.push({ repo, skills: [name] });
  }

  // Not in `skills list` → `skills add`. Usually missing skills, but after a
  // failed list it's all of them, so note what was already on disk first.
  const addNames = toAdd.flatMap((e) => e.skills);
  const preExisting = new Set((await verifyInstalled(addNames, skillsStore)).installed);
  const added: { name: string; repo: string; failure: string | null }[] = [];
  for (const entry of toAdd) {
    const run = await addCaptured(entry.repo, entry.skills, collector);
    for (const name of entry.skills) added.push({ name, repo: entry.repo, failure: addFailureFor(name, run) });
  }
  if (added.length > 0) {
    const lockAfterAdd = await readSkillLock(lockPath);
    const onDisk = new Set((await verifyInstalled(addNames, skillsStore)).installed);
    for (const { name, repo, failure } of added) {
      const lockChange = diffLockEntry(lockBefore, lockAfterAdd, name);
      const outcome = classifyAddedSkill({ name, skillsStore, preExisted: preExisting.has(name), onDisk: onDisk.has(name), failure, lockChange });
      collector.setSkill({ name, repo, ...outcome });
    }
  }

  // Present skills → one batched `skills update` for those it can check;
  // failures retried via `add --json`.
  const updateCtx: UpdateContext = { lockBefore, lockPath, repoOf, skillsStore, collector };
  const checkable = reportUncheckable(toUpdate, updateCtx);
  const reportedUpdated = checkable.length > 0 ? await updateCaptured(checkable, updateCtx) : new Set<string>();

  // Pins: immutable, so present means done.
  for (const entry of pinnedEntries) {
    const name = entry.skills[0]!;
    try {
      if (await pathExists(join(skillsStore, name))) {
        collector.setSkill({ name, repo: entry.repo, status: "pinned" });
        continue;
      }
      await installPinnedSkill(entry, skillsStore, true);
      collector.appendTranscript(`[pinned] ${name} @ ${entry.pin.ref.slice(0, 12)} → ${join(skillsStore, name)}`, "");
      collector.setSkill({ name, repo: entry.repo, status: "installed", note: `pinned @ ${entry.pin.ref}` });
    } catch (err: unknown) {
      collector.setSkill({ name, repo: entry.repo, status: "failed", error: describeError(err) });
    }
  }

  // Final statuses + hashes from the lockfile diff.
  const lockAfter = await readSkillLock(lockPath);
  const { missing: goneAfterUpdate } = await verifyInstalled(toUpdate, skillsStore);
  for (const name of toUpdate) {
    const current = collector.getSkill(name);
    if (current?.status === "failed") continue;
    const repo = repoOf.get(name) ?? "";
    if (goneAfterUpdate.includes(name)) {
      collector.setSkill({ name, repo, status: "failed", error: `${name}/SKILL.md is no longer in ${skillsStore} after \`skills update\`.` });
      continue;
    }
    const changed = diffLockEntry(lockBefore, lockAfter, name) === "updated" || reportedUpdated.has(name);
    collector.setSkill({
      name,
      repo,
      status: changed ? "updated" : "unchanged",
      ...(current?.note ? { note: current.note } : {}),
    });
  }
  attachHashes(collector, [...repoOf.keys()], lockBefore, lockAfter);
  collector.reorder([...repoOf.keys()]);

  // Symlinks for every other active agent, same as normal mode — for every
  // skill that is on disk, including a failed update's old copy.
  const { installed: linkable } = await verifyInstalled([...repoOf.keys()], skillsStore);
  const symlinkAgents = agentsConfig.filter((a) => a.enabled && a.skillsPath != null && a.id !== CANONICAL_STORE_AGENT_ID);
  if (symlinkAgents.length > 0 && linkable.length > 0) {
    try {
      await createSkillSymlinks(symlinkAgents, linkable, skillsStore, collector.logger());
    } catch (err: unknown) {
      collector.addError(`Creating agent symlinks failed:\n${describeError(err)}`);
    }
  }
}

function attachHashes(collector: SkillsReportCollector, names: string[], before: SkillLock, after: SkillLock): void {
  for (const name of names) {
    const entry = collector.getSkill(name);
    if (!entry) continue;
    const oldHash = lockHash(before, name);
    const newHash = lockHash(after, name);
    const next: SkillReportEntry = { ...entry };
    if (oldHash) next.oldHash = oldHash;
    if (newHash) next.newHash = newHash;
    collector.setSkill(next);
  }
}
