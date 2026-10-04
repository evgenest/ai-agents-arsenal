import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { cleanLines, describeError, stripAnsi } from "./errors";

/**
 * Machine-readable result of the global skills phase, written by
 * `--report <path>`. This shape is a contract with external consumers
 * (e.g. an `update-all` style wrapper that shows only what changed), so
 * bump `version` on any incompatible change.
 */
export type SkillReportStatus = "updated" | "installed" | "failed" | "unchanged" | "pinned";

export type SkillReportEntry = {
  name: string;
  repo: string;
  status: SkillReportStatus;
  /** `skillFolderHash` from the `skills` CLI lockfile before the run, when present. */
  oldHash?: string;
  /** `skillFolderHash` from the `skills` CLI lockfile after the run, when present. */
  newHash?: string;
  /** Full failure text (ANSI stripped) when `status` is "failed". */
  error?: string;
  /** Extra context for a non-failed status, e.g. a failure that a retry recovered. */
  note?: string;
};

export type SkillsReport = {
  version: 1;
  cli: { before: string | null; after: string | null; error: string | null };
  skills: SkillReportEntry[];
  /** Failures not tied to a single skill — full text. */
  errors: string[];
  /** All captured child output, ANSI stripped. */
  transcript: string;
};

// ─── repo names ─────────────────────────────────────────────────────────────

/** `owner/repo`, `https://github.com/owner/repo(.git)` and `git@github.com:owner/repo.git` all compare equal. */
export function normalizeRepo(source: string): string {
  return source
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?github\.com\//, "")
    .replace(/^git@github\.com:/, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
}

// ─── `skills add --json` output ─────────────────────────────────────────────

export type AddJsonResult = {
  /** Per requested skill name: what the CLI said about it. */
  bySkill: Map<string, { status: string; error?: string }>;
  /** Failures the CLI reported without a skill name (e.g. clone failed). */
  general: string[];
};

/**
 * `skills add --json` prints a JSON array on stdout (its human-readable log
 * goes to stderr in that mode): `{name, status: "installed"|"failed"|"skipped",
 * error?, reason?}` per skill, or a single nameless `{status: "failed", error}`
 * when the whole call failed. Returns null if stdout isn't that array.
 */
export function parseAddJson(stdout: string): AddJsonResult | null {
  const text = stripAnsi(stdout).trim();
  const start = text.indexOf("[");
  if (start === -1) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const result: AddJsonResult = { bySkill: new Map(), general: [] };
  for (const item of parsed as Record<string, unknown>[]) {
    if (!item || typeof item !== "object") continue;
    const status = typeof item.status === "string" ? item.status : "unknown";
    const message = [item.error, item.reason].find((v): v is string => typeof v === "string");
    if (typeof item.name === "string") {
      result.bySkill.set(item.name, { status, ...(message ? { error: message } : {}) });
    } else if (message) {
      result.general.push(message);
    }
  }
  return result;
}

// ─── collecting and writing ─────────────────────────────────────────────────

export class SkillsReportCollector {
  cli: SkillsReport["cli"] = { before: null, after: null, error: null };
  readonly errors: string[] = [];
  private readonly skills = new Map<string, SkillReportEntry>();
  private readonly transcriptParts: string[] = [];
  /** Whether the last transcript part came from logger(), so consecutive log lines stay together. */
  private lastPartIsLog = false;

  /** Appends one command's output under a `$ <command>` header. */
  appendTranscript(command: string, output: string, exitCode?: number): void {
    const body = cleanLines(output).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    const header = exitCode === undefined ? `$ ${command}` : `$ ${command}  [exit ${exitCode}]`;
    this.transcriptParts.push(body ? `${header}\n${body}` : header);
    this.lastPartIsLog = false;
  }

  /** A logger that writes lines into the transcript instead of the console. */
  logger(): (line: string) => void {
    return (line) => {
      const clean = stripAnsi(line);
      if (this.lastPartIsLog && this.transcriptParts.length > 0) {
        this.transcriptParts[this.transcriptParts.length - 1] += `\n${clean}`;
      } else {
        this.transcriptParts.push(clean);
      }
      this.lastPartIsLog = true;
    };
  }

  setSkill(entry: SkillReportEntry): void {
    this.skills.set(entry.name, entry);
  }

  getSkill(name: string): SkillReportEntry | undefined {
    return this.skills.get(name);
  }

  /** Puts skills in `names` order (e.g. config order); any others keep their place after them. */
  reorder(names: string[]): void {
    const entries = new Map(this.skills);
    this.skills.clear();
    for (const name of names) {
      const entry = entries.get(name);
      if (entry) this.skills.set(name, entry);
    }
    for (const [name, entry] of entries) {
      if (!this.skills.has(name)) this.skills.set(name, entry);
    }
  }

  addError(text: string): void {
    this.errors.push(stripAnsi(text).trimEnd());
  }

  hasFailures(): boolean {
    return this.errors.length > 0 || [...this.skills.values()].some((s) => s.status === "failed");
  }

  build(): SkillsReport {
    return {
      version: 1,
      cli: { ...this.cli },
      skills: [...this.skills.values()],
      errors: [...this.errors],
      transcript: this.transcriptParts.join("\n\n"),
    };
  }

  /** The single stdout line `--report` mode prints. */
  summaryLine(reportPath: string): string {
    const counts = new Map<SkillReportStatus, number>();
    for (const skill of this.skills.values()) counts.set(skill.status, (counts.get(skill.status) ?? 0) + 1);
    const order: SkillReportStatus[] = ["updated", "installed", "failed", "unchanged", "pinned"];
    const parts = order.filter((s) => counts.has(s)).map((s) => `${counts.get(s)} ${s}`);
    if (this.errors.length > 0) parts.push(`${this.errors.length} error(s)`);
    if (this.cli.error) parts.push("skills CLI refresh failed");
    return `skills: ${parts.length > 0 ? parts.join(", ") : "nothing to do"} → report: ${reportPath}`;
  }
}

/** Writes via a temp file + rename, so a reader never sees a half-written report. */
export async function writeReport(path: string, report: SkillsReport): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmpPath = `${path}.${process.pid}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
  await rename(tmpPath, path);
}

function describeUnexpected(err: unknown): string {
  const details = describeError(err);
  if (err instanceof Error && err.stack && !("stderr" in err)) {
    return err.stack.includes(details) ? err.stack : `${details}\n${err.stack}`;
  }
  return details;
}

export type RunWithReportDeps = {
  write?: (path: string, report: SkillsReport) => Promise<void>;
  log?: (line: string) => void;
  logError?: (line: string) => void;
};

/**
 * Runs `body` and always writes the report afterwards, even if `body`
 * throws: the exception is recorded in `errors` rather than propagated, so
 * the consumer still gets a complete report. Sets `process.exitCode = 1`
 * when any skill failed, any error was recorded, or the report itself could
 * not be written.
 */
export async function runWithReport(
  reportPath: string,
  collector: SkillsReportCollector,
  body: () => Promise<void>,
  deps: RunWithReportDeps = {},
): Promise<void> {
  const write = deps.write ?? writeReport;
  const log = deps.log ?? console.log;
  const logError = deps.logError ?? console.error;

  try {
    await body();
  } catch (err: unknown) {
    collector.addError(`Unexpected error during the skills phase:\n${describeUnexpected(err)}`);
  } finally {
    try {
      await write(reportPath, collector.build());
      log(collector.summaryLine(reportPath));
      if (collector.hasFailures()) process.exitCode = 1;
    } catch (err: unknown) {
      logError(`✗ Could not write the skills report to ${reportPath}:\n${describeError(err)}`);
      process.exitCode = 1;
    }
  }
}
