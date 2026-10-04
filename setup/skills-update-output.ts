import { cleanLines } from "./errors";

/**
 * Parsing what `skills update -g -y` prints. Its per-skill re-installs run
 * with their own output piped and discarded, and several of its problems
 * never reach the exit code, so these lines are all the CLI tells us.
 */

/** A multi-line notice from `skills update`: the header line plus its bullets. */
export type UpdateWarning = {
  /** The whole block, ANSI stripped, original indentation kept. */
  text: string;
  /** Skill names its bullets list (may be empty if none could be extracted). */
  names: string[];
};

export type UpdateOutput = {
  /** `✓ Updated <name>` per-skill lines (not the `✓ Updated N skill(s)` total). */
  updated: string[];
  /** `✗ Failed to update <name>` / `✗ Cannot update <name>: …` lines. */
  failed: { name: string; line: string }[];
  /** `✗ Failed to check skills from <source>` — does NOT set the CLI's exit code. */
  sourceFailures: { source: string; line: string }[];
  /** Any other `✗ …` line. */
  otherFailures: string[];
  /**
   * Notice blocks that also leave the exit code at 0 while the named skills
   * stay un-updated (cli.mjs, updateGlobalSkills and helpers):
   * - `Warning: The following skills from <src> appear to have been deleted upstream:`
   *   + `• <name>` bullets + `Skipping deletion in non-interactive mode.`
   * - `Warning: Multiple current paths match these skills from <src>; skipping them …:`
   *   + `• <name>` bullets
   * - `N skill(s) cannot be checked automatically:` + `• <names> (<reason>)`
   *   bullets, each followed by a `To update: …` line
   */
  warnings: UpdateWarning[];
};

const WARNING_START = /^(?:Warning:|\d+ skill\(s\) cannot be checked automatically:)/;

/** A line that belongs to the warning block above it. */
function isContinuation(rawLine: string): boolean {
  const line = rawLine.trim();
  if (!line || line.startsWith("✓") || line.startsWith("✗")) return false;
  return /^\s/.test(rawLine) || line.startsWith("Skipping deletion");
}

/** `• a, b (reason)` → ["a", "b"]; `• name` → ["name"]. */
function bulletNames(line: string): string[] {
  const bullet = /^•\s+(.+)$/.exec(line.trim());
  if (!bullet) return [];
  return bullet[1]!
    .replace(/\s+\([^)]*\)$/, "")
    .split(/,\s*/)
    .map((name) => name.trim())
    .filter(Boolean);
}

export function parseUpdateOutput(raw: string): UpdateOutput {
  const result: UpdateOutput = { updated: [], failed: [], sourceFailures: [], otherFailures: [], warnings: [] };
  const lines = cleanLines(raw);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!.trim();
    if (!line) continue;

    if (WARNING_START.test(line)) {
      const block = [line];
      const names: string[] = [];
      while (index + 1 < lines.length && isContinuation(lines[index + 1]!)) {
        index += 1;
        block.push(lines[index]!.trimEnd());
        names.push(...bulletNames(lines[index]!));
      }
      result.warnings.push({ text: block.join("\n"), names });
      continue;
    }

    const updated = /^✓\s+Updated\s+(.+)$/.exec(line);
    if (updated) {
      if (!/^\d+ skill\(s\)$/.test(updated[1]!)) result.updated.push(updated[1]!.trim());
      continue;
    }

    const source = /^✗\s+Failed to check skills from\s+(.+)$/.exec(line);
    if (source) {
      result.sourceFailures.push({ source: source[1]!.trim(), line });
      continue;
    }

    const failed = /^✗\s+(?:Failed to update|Cannot update)\s+([^:\s][^:]*?)\s*(?::\s.*)?$/.exec(line);
    if (failed) {
      result.failed.push({ name: failed[1]!, line });
      continue;
    }

    if (line.startsWith("✗")) result.otherFailures.push(line);
  }
  return result;
}
