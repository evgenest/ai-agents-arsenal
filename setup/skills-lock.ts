import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Reading and diffing the `skills` CLI's global lockfile. `--report` takes
 * "updated" vs "unchanged" from this file, never from the CLI's output.
 */

export type SkillLockEntry = {
  source?: string;
  sourceType?: string;
  skillFolderHash?: string;
  skillPath?: string;
  sourceBaseUrl?: string;
  wellKnownDigest?: string;
};
export type SkillLock = Record<string, SkillLockEntry>;

/**
 * Same resolution the `skills` CLI itself uses (getSkillLockPath in its
 * dist/cli.mjs): `$XDG_STATE_HOME/skills/.skill-lock.json` when that
 * variable is set, else `~/.agents/.skill-lock.json`.
 */
export function skillLockPath(env: Record<string, string | undefined> = process.env, home = homedir()): string {
  const xdgStateHome = env.XDG_STATE_HOME;
  if (xdgStateHome) return join(xdgStateHome, "skills", ".skill-lock.json");
  return join(home, ".agents", ".skill-lock.json");
}

/**
 * Reads the lockfile's `skills` map. A missing, unreadable, or pre-v3
 * lockfile reads as empty — the same thing the CLI does, so a diff against
 * it treats every skill as newly appearing rather than throwing.
 */
export async function readSkillLock(path: string): Promise<SkillLock> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf-8")) as { version?: unknown; skills?: unknown };
    if (typeof parsed.version !== "number" || parsed.version < 3) return {};
    if (!parsed.skills || typeof parsed.skills !== "object") return {};
    return parsed.skills as SkillLock;
  } catch {
    return {};
  }
}

export function lockHash(lock: SkillLock, name: string): string | undefined {
  const hash = lock[name]?.skillFolderHash;
  return typeof hash === "string" && hash.length > 0 ? hash : undefined;
}

/** Case-insensitive lock lookup, the way `skills update <names>` matches its filter. */
export function findLockEntry(lock: SkillLock, name: string): SkillLockEntry | undefined {
  if (Object.hasOwn(lock, name)) return lock[name];
  const lower = name.toLowerCase();
  const key = Object.keys(lock).find((k) => k.toLowerCase() === lower);
  return key === undefined ? undefined : lock[key];
}

/**
 * Why `skills update` can't check this skill, or null if it can. Mirrors
 * updateGlobalSkills/getSkipReason in the CLI's dist/cli.mjs: a name with no
 * lock entry is dropped from the update without a word, and an entry without
 * `skillFolderHash` + `skillPath` (well-known sources aside) is "skipped",
 * which the CLI lists only on runs that also found an update. Either way the
 * skill would otherwise look "unchanged" forever.
 */
export function uncheckableReason(entry: SkillLockEntry | undefined): string | null {
  if (!entry) return "not tracked in the skills CLI lockfile";
  if (entry.sourceType === "well-known" && entry.sourceBaseUrl && entry.wellKnownDigest) return null;
  if (entry.skillFolderHash && entry.skillPath) return null;
  if (entry.sourceType === "local") return "Local path";
  if (entry.sourceType === "git") return "Git URL";
  if (entry.sourceType === "well-known") return "Well-known skill";
  if (!entry.skillFolderHash) return "Private or deleted repo";
  if (!entry.skillPath) return "No skill path recorded";
  return "No version tracking";
}

export type LockChange = "installed" | "updated" | "unchanged" | "absent";

/** How one skill's lock entry moved between two snapshots. */
export function diffLockEntry(before: SkillLock, after: SkillLock, name: string): LockChange {
  if (!(name in after)) return "absent";
  if (!(name in before)) return "installed";
  return lockHash(before, name) === lockHash(after, name) ? "unchanged" : "updated";
}

/** Every name in either snapshot, with its change. */
export function diffLocks(before: SkillLock, after: SkillLock): Record<string, LockChange> {
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  const result: Record<string, LockChange> = {};
  for (const name of [...names].sort()) {
    result[name] = diffLockEntry(before, after, name);
  }
  return result;
}
