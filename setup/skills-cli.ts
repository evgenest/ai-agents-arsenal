import { stat } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { describeError, extractErrorDetails } from "./errors";

/**
 * The `skills` CLI major version this arsenal release was verified against.
 * The `--report` flow parses that CLI's human-readable output and lockfile
 * layout, neither of which is a stable interface, so a different major
 * (e.g. after `bun update -g --latest`) is flagged until someone re-checks
 * that skills still update correctly and bumps this.
 */
export const TESTED_SKILLS_CLI_MAJOR = 1;

export type SkillsCliRefresh = {
  /** `skills` version before this step, or null if it wasn't a global bun package yet. */
  before: string | null;
  /** `skills` version after this step, or null if it still isn't a global bun package. */
  after: string | null;
  /** Full error text when `bun add/update -g skills` failed, otherwise null. */
  error: string | null;
  /** The command that ran, e.g. `bun update -g skills`. */
  command: string;
  /** Everything the command printed (stdout + stderr). */
  output: string;
};

/**
 * Every command in the skills setup runs the `skills` CLI through
 * `bunx skills ...`. `bunx` resolves a package that's already installed
 * globally via bun (`bun add -g skills`) directly, with no registry
 * round-trip at all. Without a global install, every unpinned
 * `bunx skills ...` call — and the setup makes several per run (list, add,
 * update, one per pinned project-scope agent) — re-resolves against the
 * registry from scratch, so this step both installs `skills` globally on
 * first use and, once it's there, keeps it current:
 *
 * - Not yet a global bun package → `bun add -g skills` (one-time; every
 *   later `bunx skills` call in this and future runs then resolves
 *   instantly, with no registry round-trip).
 * - Already a global bun package → `bun update -g skills` (`bunx` never
 *   checks this on its own, so it would otherwise go stale indefinitely).
 *
 * Deliberately no `--latest` on the update path: that flag discards the
 * semver range recorded in `~/.bun/install/global/package.json` (`^x.y.z`
 * by default) and jumps straight to whatever npm's `latest` dist-tag
 * currently points to, which isn't necessarily a well-vetted release for
 * every package. Plain `bun update -g skills` stays within that
 * already-accepted range — patch and minor bumps only, no crossing a major
 * version, and no prereleases unless one was explicitly requested when the
 * range was first set. A fresh `bun add -g skills` has no prior range to
 * respect, so it takes whatever the registry's own `latest` tag is, same as
 * any other first-time install.
 *
 * A failure here never stops the run — `bunx skills` still works below,
 * just without the speed-up (or with whatever was already installed) — but
 * it is no longer swallowed either: the error comes back in `error`, and
 * the caller prints it (normal mode) or records it in the report
 * (`--report`). Versions are read before and after so "up to date" is only
 * claimed when nothing actually changed.
 */
export async function refreshGlobalSkillsCli(): Promise<SkillsCliRefresh> {
  const existingPackageJsonPath = await resolveGlobalSkillsPackageJson();
  const before = existingPackageJsonPath ? await readPackageVersion(existingPackageJsonPath) : null;
  const verb = existingPackageJsonPath ? "update" : "add";
  const command = `bun ${verb} -g skills`;

  let output = "";
  let error: string | null = null;
  try {
    const result = await $`bun ${verb} -g skills`.quiet().nothrow();
    output = result.stdout.toString() + result.stderr.toString();
    if (result.exitCode !== 0) {
      error = `\`${command}\` exited with code ${result.exitCode}:\n${extractErrorDetails(output) || "(no output)"}`;
    }
  } catch (err: unknown) {
    error = `\`${command}\` could not run:\n${describeError(err)}`;
  }

  const packageJsonPath = existingPackageJsonPath ?? await resolveGlobalSkillsPackageJson();
  const after = packageJsonPath ? await readPackageVersion(packageJsonPath) : null;
  return { before, after, error, command, output };
}

/** Console lines for normal (non-report) mode, matching the rest of the setup output. */
export function describeSkillsCliRefresh(refresh: SkillsCliRefresh): { lines: string[]; warnings: string[] } {
  const { before, after, error, command } = refresh;
  if (error) {
    const fallback = after ? `the installed v${after}` : "whatever `bunx` resolves on its own";
    return {
      lines: [],
      warnings: [
        `  ⚠ Could not refresh the global \`skills\` CLI (${command}) — continuing with ${fallback}:`,
        ...error.split("\n").map((line) => `      ${line}`),
      ],
    };
  }
  if (!after) {
    return { lines: [], warnings: [] };
  }
  if (!before) {
    return { lines: [`  ✓ Installed \`skills\` CLI globally (v${after}) — future runs skip the registry round-trip`], warnings: [] };
  }
  if (before !== after) {
    return { lines: [`  ✓ Updated global \`skills\` CLI v${before} → v${after}`], warnings: [] };
  }
  return { lines: [`  ✓ Global \`skills\` CLI is up to date (v${after})`], warnings: [] };
}

/**
 * The warning for an untested `skills` major, or null when the installed
 * major (after the refresh, else before it) is the tested one or unknown.
 */
export function checkSkillsCliMajor(
  refresh: Pick<SkillsCliRefresh, "before" | "after">,
  arsenalVersion: string,
  testedMajor = TESTED_SKILLS_CLI_MAJOR,
): string | null {
  const version = (refresh.after ?? refresh.before)?.replace(/^v/, "");
  const major = version ? /^v?(\d+)\./.exec(version)?.[1] : undefined;
  if (major === undefined || Number(major) === testedMajor) return null;
  return `skills CLI v${version} is untested with ai-agents-arsenal ${arsenalVersion} (verified with ${testedMajor}.x) — `
    + "check that skills still update correctly, then bump TESTED_SKILLS_CLI_MAJOR";
}

/** Path to the globally bun-installed `skills` package's package.json, or null if it isn't one. */
async function resolveGlobalSkillsPackageJson(): Promise<string | null> {
  try {
    const result = await $`bun pm bin -g`.quiet();
    const globalBinDir = result.stdout.toString().trim();
    const packageJsonPath = join(globalBinDir, "..", "install", "global", "node_modules", "skills", "package.json");
    await stat(packageJsonPath);
    return packageJsonPath;
  } catch {
    return null;
  }
}

async function readPackageVersion(packageJsonPath: string): Promise<string | null> {
  try {
    const raw = await Bun.file(packageJsonPath).json() as { version?: unknown };
    return typeof raw.version === "string" ? raw.version : null;
  } catch {
    return null;
  }
}
