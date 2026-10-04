import { $ } from "bun";
import { describeError, extractErrorDetails } from "./errors";
import type { AddRun, Captured } from "./skills-add-result";
import { parseAddJson, type SkillsReportCollector } from "./skills-report";
import { CANONICAL_STORE_AGENT_ID } from "./skills";

/** `bunx skills <args>`, captured into the transcript; never throws. */
export async function runSkillsCaptured(args: string[], collector: SkillsReportCollector): Promise<Captured> {
  const command = `bunx skills ${args.join(" ")}`;
  try {
    const result = await $`bunx skills ${args}`.quiet().nothrow();
    const captured = { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
    collector.appendTranscript(command, captured.stdout + captured.stderr, captured.exitCode);
    return captured;
  } catch (err: unknown) {
    const stderr = describeError(err);
    collector.appendTranscript(command, stderr, -1);
    return { exitCode: -1, stdout: "", stderr };
  }
}

/**
 * `skills list -g --json` names. On failure the error goes into the report
 * and an empty set comes back, so every skill is (re-)added — which is why
 * the add path must tell pre-existing skills apart (classifyAddedSkill).
 */
export async function listInstalled(collector: SkillsReportCollector): Promise<Set<string>> {
  const result = await runSkillsCaptured(["list", "-g", "--json"], collector);
  try {
    if (result.exitCode !== 0) throw new Error(`exit code ${result.exitCode}`);
    const entries = JSON.parse(result.stdout) as { name: string }[];
    return new Set(entries.map((e) => e.name));
  } catch (err: unknown) {
    collector.addError(
      `\`skills list -g --json\` failed (${describeError(err)}) — treating every skill as missing:\n`
      + (extractErrorDetails(result.stdout + result.stderr) || "(no output)"),
    );
    return new Set();
  }
}

export async function addCaptured(repo: string, names: string[], collector: SkillsReportCollector): Promise<AddRun> {
  const skillArgs = names.flatMap((s) => ["--skill", s]);
  const result = await runSkillsCaptured(
    ["add", repo, ...skillArgs, "-g", "-a", CANONICAL_STORE_AGENT_ID, "-y", "--json"],
    collector,
  );
  return { result, json: parseAddJson(result.stdout) };
}
