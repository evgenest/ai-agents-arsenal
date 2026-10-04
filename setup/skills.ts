import { cp, mkdir, mkdtemp, rm, stat, symlink, unlink } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { readArsenalVersion, type AgentConfigEntry, type SkillsConfigEntry, type SkillsPin } from "./config";
import { describeError } from "./errors";
import { checkSkillsCliMajor, describeSkillsCliRefresh, refreshGlobalSkillsCli } from "./skills-cli";

// Kept importable from here for existing callers/tests; they live in ./errors.
export { describeError, extractErrorDetails, stripAnsi } from "./errors";

export type SkillsInstallScope = "global" | "project";

type Failure = { repo: string; skills: string[]; error: string };

/** Line sink for progress output; defaults to the console, `--report` mode captures it instead. */
export type LineLogger = (line: string) => void;

/**
 * The agent whose own global skills directory doubles as our canonical
 * store for global installs: Claude Code. Passing `-a claude-code` (and
 * only `claude-code`) makes the `skills` CLI write a skill's real files
 * directly into that one directory, with no intermediate `~/.agents/skills/`
 * copy and no extra symlink layer — verified by inspection, not documented
 * CLI behavior, so treat it as an implementation detail we depend on rather
 * than a guarantee. We picked Claude Code over an arbitrary third-party
 * agent (e.g. `cline`, whose own global path also happens to be a shared
 * default `~/.agents/skills/`) because it's the one agent this toolkit can
 * assume is always configured, and its path is under our own control via
 * `agents.config.ts` rather than an upstream default we don't own.
 */
export const CANONICAL_STORE_AGENT_ID = "claude-code";

export async function setupSkills(
  agentsConfig: AgentConfigEntry[],
  skillsConfig: SkillsConfigEntry[],
  scope: SkillsInstallScope = "global",
) {
  await ensureGlobalSkillsCliFresh();

  const activeAgents = agentsConfig.filter((a) => a.enabled);

  if (scope === "project") {
    await setupProjectSkills(activeAgents, skillsConfig);
    return;
  }

  await setupGlobalSkills(agentsConfig, activeAgents, skillsConfig);
}

/**
 * Installs/updates the global `skills` CLI (see refreshGlobalSkillsCli for
 * why) and prints the outcome. A failure, or a `skills` major this release
 * wasn't verified against, doesn't stop the run, but it's printed as a
 * warning rather than silently swallowed.
 */
async function ensureGlobalSkillsCliFresh(): Promise<void> {
  const refresh = await refreshGlobalSkillsCli();
  const { lines, warnings } = describeSkillsCliRefresh(refresh);
  for (const line of lines) console.log(line);
  for (const line of warnings) console.warn(line);
  const untested = checkSkillsCliMajor(refresh, await readArsenalVersion());
  if (untested) console.warn(`  ⚠ ${untested}`);
}

/**
 * Project-scope installs have no shared canonical store to reuse across
 * agents, so regular entries still delegate directly to the skills CLI's
 * own `-a` targeting here, one `add` call covering every active agent.
 * Pinned entries can't use that shortcut — see installPinnedSkillToProject.
 */
async function setupProjectSkills(activeAgents: AgentConfigEntry[], skillsConfig: SkillsConfigEntry[]) {
  const agentArgs = activeAgents.flatMap((a) => ["-a", a.id]);
  const successfulSkills: string[] = [];
  const failures: Failure[] = [];

  for (const entry of skillsConfig) {
    try {
      if (hasPin(entry)) {
        await installPinnedSkillToProject(entry, activeAgents);
      } else {
        const skillArgs = entry.skills.flatMap((s) => ["--skill", s]);
        await $`bunx skills add ${entry.repo} ${skillArgs} ${agentArgs} -y`;
      }
      successfulSkills.push(...entry.skills);
    } catch (err: unknown) {
      failures.push({ repo: entry.repo, skills: entry.skills, error: describeError(err) });
    }
  }

  printSummary({ installed: successfulSkills, updated: [], failures, symlinkedAgents: [] });
}

/**
 * Global-scope installs go straight to the canonical store — Claude Code's
 * own global skills directory, see CANONICAL_STORE_AGENT_ID — without ever
 * passing our active agents to the skills CLI's `-a` flag: skills already
 * present are refreshed with `skills update` (fast, no repo re-clone),
 * skills that are missing are added via `skills add ... -a claude-code`.
 * We then create every *other* active agent's symlink into that store
 * ourselves, from `skillsPath` in `agents.config.ts`.
 */
async function setupGlobalSkills(
  agentsConfig: AgentConfigEntry[],
  activeAgents: AgentConfigEntry[],
  skillsConfig: SkillsConfigEntry[],
) {
  const skillsStore = resolveCanonicalStore(agentsConfig);
  const installed = await listInstalledGlobalSkills();
  const { toAdd, toUpdate, pinnedEntries } = planGlobalSkills(skillsConfig, installed);

  const installedSkills: string[] = [];
  const updatedSkills: string[] = [];
  const pinnedSkills: string[] = [];
  const failures: Failure[] = [];

  for (const entry of toAdd) {
    const skillArgs = entry.skills.flatMap((s) => ["--skill", s]);
    try {
      await $`bunx skills add ${entry.repo} ${skillArgs} -g -a ${CANONICAL_STORE_AGENT_ID} -y`;
      const { installed, missing } = await verifyInstalled(entry.skills, skillsStore);
      installedSkills.push(...installed);
      if (missing.length > 0) {
        failures.push({
          repo: entry.repo,
          skills: missing,
          error: `\`skills add\` reported success but installed nothing for these names.\n`
            + `The source repo doesn't carry them under those names — upstream most likely\n`
            + `renamed or removed them. Check the repo's current skill list and update\n`
            + `config/skills.config.ts.`,
        });
      }
    } catch (err: unknown) {
      failures.push({ repo: entry.repo, skills: entry.skills, error: describeError(err) });
    }
  }

  if (toUpdate.length > 0) {
    try {
      await $`bunx skills update ${toUpdate} -g -y`;
      updatedSkills.push(...toUpdate);
    } catch (err: unknown) {
      failures.push({ repo: "(update)", skills: toUpdate, error: describeError(err) });
    }
  }

  for (const entry of pinnedEntries) {
    const skillName = entry.skills[0]!;
    const targetDir = join(skillsStore, skillName);
    try {
      if (await pathExists(targetDir)) {
        pinnedSkills.push(skillName);
        continue;
      }
      await installPinnedSkill(entry, skillsStore);
      console.log(`  ✓ [pinned] ${skillName} @ ${entry.pin.ref.slice(0, 12)} → ${targetDir}`);
      pinnedSkills.push(skillName);
    } catch (err: unknown) {
      failures.push({ repo: entry.repo, skills: entry.skills, error: describeError(err) });
    }
  }

  const successfulSkills = [...installedSkills, ...updatedSkills, ...pinnedSkills];
  const symlinkAgents = activeAgents.filter((a) => a.skillsPath != null && a.id !== CANONICAL_STORE_AGENT_ID);
  if (symlinkAgents.length > 0 && successfulSkills.length > 0) {
    await createSkillSymlinks(symlinkAgents, successfulSkills, skillsStore);
  }

  printSummary({
    installed: installedSkills,
    updated: updatedSkills,
    pinned: pinnedSkills,
    failures,
    symlinkedAgents: symlinkAgents.map((a) => a.id),
  });
}

/** Claude Code's global skills directory — the canonical store every other agent symlinks into. */
export function resolveCanonicalStore(agentsConfig: AgentConfigEntry[]): string {
  const canonicalAgent = agentsConfig.find((a) => a.id === CANONICAL_STORE_AGENT_ID);
  if (!canonicalAgent?.skillsPath) {
    throw new Error(
      `agents.config.ts must define a "${CANONICAL_STORE_AGENT_ID}" entry with a skillsPath — `
      + `its global skills directory doubles as the canonical store for all other agents' symlinks.`,
    );
  }
  return resolveHome(canonicalAgent.skillsPath);
}

export type GlobalSkillsPlan = {
  /** Missing skills, grouped per source repo, for `skills add`. */
  toAdd: SkillsConfigEntry[];
  /** Already-installed skill names, refreshed with one batched `skills update`. */
  toUpdate: string[];
  pinnedEntries: (SkillsConfigEntry & { pin: SkillsPin })[];
};

/** Splits the config into add / update / pinned work against what `skills list -g` reported. */
export function planGlobalSkills(skillsConfig: SkillsConfigEntry[], installed: Set<string>): GlobalSkillsPlan {
  const pinnedEntries = skillsConfig.filter(hasPin);
  const regularEntries = skillsConfig.filter((e) => e.pin == null);

  const toUpdate: string[] = [];
  const toAdd: SkillsConfigEntry[] = [];
  for (const entry of regularEntries) {
    const missing = entry.skills.filter((s) => !installed.has(s));
    const present = entry.skills.filter((s) => installed.has(s));
    toUpdate.push(...present);
    if (missing.length > 0) {
      toAdd.push({ repo: entry.repo, skills: missing });
    }
  }
  return { toAdd, toUpdate, pinnedEntries };
}

export function hasPin(entry: SkillsConfigEntry): entry is SkillsConfigEntry & { pin: SkillsPin } {
  return entry.pin != null;
}

/**
 * Downloads a pinned commit's tarball and extracts it to a fresh temp dir,
 * bypassing `bunx skills add` entirely. Returns the path to the skill's own
 * subdirectory (contains SKILL.md at its root — a valid `skills add` local
 * path source on its own) plus the temp root the caller must clean up.
 *
 * This exists because the `skills` CLI can't be pointed at an arbitrary
 * commit for every repo: for repos it fast-paths (e.g. `vercel-labs/*`), it
 * first tries fetching the packaged skill from Vercel's own hosted
 * skills.sh download API by slug — which ignores our requested ref entirely
 * and can simply not have the skill anymore — and only falls back to
 * `git clone --branch <ref>` if that fails, which only ever resolves real
 * branch/tag names, never a raw commit SHA. Fetching the tarball ourselves
 * sidesteps both.
 */
async function fetchPinnedSkill(
  entry: SkillsConfigEntry & { pin: SkillsPin },
  quiet = false,
): Promise<{ tmpRoot: string; skillDir: string }> {
  const tarballUrl = `https://codeload.github.com/${entry.repo}/tar.gz/${entry.pin.ref}`;
  const tmpRoot = await mkdtemp(join(tmpdir(), "ai-agents-arsenal-pin-"));
  const fetch = $`curl -fsSL ${tarballUrl} | tar xz -C ${tmpRoot} --strip-components=1`;
  await (quiet ? fetch.quiet() : fetch);
  return { tmpRoot, skillDir: join(tmpRoot, entry.pin.path) };
}

/**
 * Global-scope pinned install: materializes straight into the canonical store.
 * `quiet` keeps curl/tar output off the console (`--report` mode); a failure
 * still throws a ShellError carrying that output.
 */
export async function installPinnedSkill(
  entry: SkillsConfigEntry & { pin: SkillsPin },
  skillsStore: string,
  quiet = false,
): Promise<void> {
  const skillName = entry.skills[0]!;
  const targetDir = join(skillsStore, skillName);
  const { tmpRoot, skillDir } = await fetchPinnedSkill(entry, quiet);

  try {
    await mkdir(skillsStore, { recursive: true });
    await rm(targetDir, { recursive: true, force: true });
    await cp(skillDir, targetDir, { recursive: true });
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

/**
 * Project-scope pinned install: hands the materialized skill to
 * `bunx skills add <localDir>` so the CLI still owns each agent's own
 * project-relative skill path (we don't maintain that table ourselves).
 *
 * Installs one agent at a time rather than passing every active agent in a
 * single `-a a -a b` call. Verified by hand: for a *local path* source,
 * this build of the `skills` CLI's pre-install plan lists every requested
 * agent, but the post-install summary — and the filesystem — show only the
 * first one actually got a symlink; the rest are silently dropped. Regular
 * (non-pinned) entries don't hit this, since a remote repo source installs
 * to every requested agent correctly.
 */
async function installPinnedSkillToProject(
  entry: SkillsConfigEntry & { pin: SkillsPin },
  activeAgents: AgentConfigEntry[],
): Promise<void> {
  const skillName = entry.skills[0]!;
  const { tmpRoot, skillDir } = await fetchPinnedSkill(entry);

  try {
    const errors: string[] = [];
    for (const agent of activeAgents) {
      try {
        await $`bunx skills add ${skillDir} --skill ${skillName} -a ${agent.id} -y`;
      } catch (err: unknown) {
        errors.push(`[${agent.id}] ${describeError(err)}`);
      }
    }
    if (errors.length > 0) {
      throw new Error(errors.join("\n\n"));
    }
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

/**
 * Splits requested skill names by whether they actually landed in the store.
 *
 * `skills add` exits 0 even when it installed only *some* of what was asked
 * for: a `--skill` name the source repo doesn't carry is dropped from the
 * selection without a warning, a non-zero exit, or anything else that
 * distinguishes it from a clean run. That happens routinely — upstream repos
 * rename and reorganize skills — and taking the exit code at face value means
 * a skill silently disappears from the machine while the summary still claims
 * it was installed. Observed with `sandbox-sdk` (split into sandbox-stable /
 * sandbox-next) and three `convex-*` skills renamed in the same week. So
 * confirm against the filesystem instead: a skill exists only if its SKILL.md
 * does, since that's exactly what Claude Code itself requires to see it.
 */
export async function verifyInstalled(
  names: string[],
  skillsStore: string,
): Promise<{ installed: string[]; missing: string[] }> {
  const installed: string[] = [];
  const missing: string[] = [];
  for (const name of names) {
    if (await pathExists(join(skillsStore, name, "SKILL.md"))) {
      installed.push(name);
    } else {
      missing.push(name);
    }
  }
  return { installed, missing };
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Global skill names already present in the canonical store (`skills list -g --json`). */
async function listInstalledGlobalSkills(): Promise<Set<string>> {
  try {
    const result = await $`bunx skills list -g --json`.quiet();
    const entries = JSON.parse(result.stdout.toString()) as { name: string }[];
    return new Set(entries.map((e) => e.name));
  } catch {
    // Fall back to treating nothing as installed — everything goes through `add`.
    return new Set();
  }
}

function printSummary(summary: {
  installed: string[];
  updated: string[];
  pinned?: string[];
  failures: Failure[];
  symlinkedAgents: string[];
}) {
  const { installed, updated, failures, symlinkedAgents } = summary;
  const pinned = summary.pinned ?? [];

  console.log("\n┌────────────────────────────────────────────────────────────");
  console.log("│  SKILLS INSTALLATION SUMMARY");
  console.log("├────────────────────────────────────────────────────────────");
  if (installed.length > 0) {
    console.log(`│  ✓ Installed:`);
    console.log(`│    ${installed.join(", ")}`);
  }
  if (updated.length > 0) {
    console.log(`│  ✓ Updated:`);
    console.log(`│    ${updated.join(", ")}`);
  }
  if (pinned.length > 0) {
    console.log(`│  ✓ Pinned (fetched from a fixed commit, not \`skills add\`):`);
    console.log(`│    ${pinned.join(", ")}`);
  }
  if (installed.length === 0 && updated.length === 0 && pinned.length === 0) {
    console.log(`│  No skills were successfully installed or updated.`);
  }
  if (symlinkedAgents.length > 0) {
    console.log(`│  ✓ Symlinked agents:`);
    console.log(`│    ${symlinkedAgents.join(", ")}`);
  }

  if (failures.length > 0) {
    console.log("├────────────────────────────────────────────────────────────");
    console.log(`│  ✗ Failures (${failures.length}):`);
    for (let i = 0; i < failures.length; i++) {
      const fail = failures[i]!;
      if (i > 0) {
        console.log(`│`);
        console.log(`│    ────────────────────────────────────────────────────────`);
      }
      console.log(`│`);
      console.log(`│    • Repository: ${fail.repo}`);
      console.log(`│      Skills: ${fail.skills.join(", ")}`);
      console.log(`│      Reason:`);
      const errorLines = fail.error.split("\n");
      for (const line of errorLines) {
        console.log(`│        ${line}`);
      }
    }
  }
  console.log("└────────────────────────────────────────────────────────────\n");
}

/**
 * For each agent that defines a `skillsPath`, create symlinks from that path
 * into the canonical skill store (Claude Code's own global skills directory).
 *
 * Existing symlinks pointing to the same target are left untouched.
 * Stale symlinks (broken or pointing elsewhere) are replaced.
 */
export async function createSkillSymlinks(
  agents: AgentConfigEntry[],
  skillNames: string[],
  skillsStore: string,
  log: LineLogger = console.log,
): Promise<void> {
  for (const agent of agents) {
    // skillsPath is guaranteed non-null here (filtered above)
    const skillsDir = resolveHome(agent.skillsPath!);
    await mkdir(skillsDir, { recursive: true });

    for (const skillName of skillNames) {
      const linkPath = join(skillsDir, skillName);
      const targetPath = join(skillsStore, skillName);
      await ensureSymlink(linkPath, targetPath, agent.id, skillName, log);
    }
  }
}

/** Resolve leading `~` to the home directory. */
function resolveHome(p: string): string {
  return p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
}

/**
 * Create a symlink at `linkPath` → `targetPath`.
 * - If it already points to `targetPath`, do nothing.
 * - If it exists but points elsewhere (or is broken), replace it.
 * - On any other error, rethrow.
 */
async function ensureSymlink(
  linkPath: string,
  targetPath: string,
  agentId: string,
  skillName: string,
  log: LineLogger,
): Promise<void> {
  try {
    await symlink(targetPath, linkPath);
    log(`  ✓ [${agentId}] ${skillName} → ${targetPath}`);
  } catch (err: unknown) {
    if (!isNodeError(err, "EEXIST")) {
      throw err;
    }

    // Link already exists — check whether it points to the right target.
    const existing = await readSymlinkTarget(linkPath);
    if (existing === targetPath) {
      return; // already correct, nothing to do
    }

    // Stale or wrong target — replace it.
    await unlink(linkPath);
    await symlink(targetPath, linkPath);
    log(`  ↺ [${agentId}] ${skillName} (replaced stale symlink)`);
  }
}

/** Read a symlink without following it. Returns null if unreadable. */
async function readSymlinkTarget(linkPath: string): Promise<string | null> {
  try {
    const { readlink } = await import("node:fs/promises");
    return await readlink(linkPath);
  } catch {
    return null;
  }
}

function isNodeError(err: unknown, code: string): err is NodeJS.ErrnoException {
  return err instanceof Error && (err as NodeJS.ErrnoException).code === code;
}

// Re-export for use in preflight / other modules that previously imported
// SkillsInstallScope directly from here.
export type { AgentConfigEntry };
