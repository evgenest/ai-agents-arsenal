import { mkdir, readdir, symlink, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import type { AgentConfigEntry, SkillsConfigEntry } from "./config";

export type SkillsInstallScope = "global" | "project";

/** Canonical storage used by the skills CLI for global installs. */
const SKILLS_STORE = join(homedir(), ".agents", "skills");

export async function setupSkills(
  agentsConfig: AgentConfigEntry[],
  skillsConfig: SkillsConfigEntry[],
  scope: SkillsInstallScope = "global",
) {
  const activeAgents = agentsConfig.filter((a) => a.enabled);
  const agentArgs = activeAgents.flatMap((a) => ["-a", a.id]);
  const globalFlag = scope === "global" ? ["-g"] : [];

  const successfulSkills: string[] = [];
  const failures: { repo: string; skills: string[]; error: string }[] = [];

  for (const entry of skillsConfig) {
    const skillArgs = entry.skills.flatMap((s) => ["--skill", s]);
    try {
      await $`bunx skills add ${entry.repo} ${skillArgs} ${globalFlag} ${agentArgs} -y`;
      successfulSkills.push(...entry.skills);
    } catch (err: unknown) {
      let details = "";
      if (err && typeof err === "object") {
        const stderr = "stderr" in err && err.stderr ? String(err.stderr) : "";
        const stdout = "stdout" in err && err.stdout ? String(err.stdout) : "";

        const cleanStderr = extractErrorDetails(stderr);
        const cleanStdout = extractErrorDetails(stdout);

        if (cleanStdout && cleanStderr) {
          if (cleanStdout.includes(cleanStderr) || cleanStderr.includes(cleanStdout)) {
            details = cleanStdout.length > cleanStderr.length ? cleanStdout : cleanStderr;
          } else {
            details = `${cleanStdout}\n\nStderr:\n${cleanStderr}`;
          }
        } else if (cleanStdout) {
          details = cleanStdout;
        } else if (cleanStderr) {
          details = cleanStderr;
        }
      }
      if (!details && err instanceof Error) {
        details = err.message;
      }
      if (!details) {
        details = String(err);
      }
      failures.push({
        repo: entry.repo,
        skills: entry.skills,
        error: details,
      });
    }
  }

  // The skills CLI places global installs in ~/.agents/skills/ and creates
  // symlinks for most agents, but does NOT do so for agents with their own
  // skill directories (e.g. antigravity-cli → ~/.gemini/antigravity-cli/skills,
  // gemini-cli → ~/.gemini/skills). We create those symlinks ourselves.
  if (scope === "global" && successfulSkills.length > 0) {
    const symlinkAgents = activeAgents.filter((a) => a.skillsPath != null);
    if (symlinkAgents.length > 0) {
      await createSkillSymlinks(symlinkAgents, successfulSkills);
    }
  }

  // Print final summary
  console.log("\n┌────────────────────────────────────────────────────────────");
  console.log("│  SKILLS INSTALLATION SUMMARY");
  console.log("├────────────────────────────────────────────────────────────");
  if (successfulSkills.length > 0) {
    console.log(`│  ✓ Successful installs:`);
    console.log(`│    ${successfulSkills.join(", ")}`);
  } else {
    console.log(`│  No skills were successfully installed.`);
  }

  if (failures.length > 0) {
    console.log("├────────────────────────────────────────────────────────────");
    console.log(`│  ✗ Failures (${failures.length}):`);
    for (let i = 0; i < failures.length; i++) {
      const fail = failures[i];
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
export function stripAnsi(str: string): string {
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");
}

/**
 * Strips ANSI codes, splits output into lines, and skips the leading ASCII logo
 * to extract the actual error content.
 */
export function extractErrorDetails(output: string): string {
  const clean = stripAnsi(output);
  const lines = clean.split("\n");

  let startIndex = 0;
  // Skip leading empty lines or logo lines
  while (startIndex < lines.length) {
    const line = lines[startIndex];
    if (line.trim() === "" || /^[ █╔═╝║╚╗\r]*$/.test(line)) {
      startIndex++;
    } else {
      break;
    }
  }

  if (startIndex >= lines.length) {
    return clean.trim();
  }

  // Join back the remaining lines and trim trailing whitespace
  return lines.slice(startIndex).join("\n").trimEnd();
}

/**
 * For each agent that defines a `skillsPath`, create symlinks from that path
 * into the canonical skill store at ~/.agents/skills/<skill>.
 *
 * Existing symlinks pointing to the same target are left untouched.
 * Stale symlinks (broken or pointing elsewhere) are replaced.
 */
async function createSkillSymlinks(
  agents: AgentConfigEntry[],
  skillNames: string[],
): Promise<void> {
  for (const agent of agents) {
    // skillsPath is guaranteed non-null here (filtered above)
    const skillsDir = resolveHome(agent.skillsPath!);
    await mkdir(skillsDir, { recursive: true });

    for (const skillName of skillNames) {
      const linkPath = join(skillsDir, skillName);
      const targetPath = join(SKILLS_STORE, skillName);
      await ensureSymlink(linkPath, targetPath, agent.id, skillName);
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
): Promise<void> {
  try {
    await symlink(targetPath, linkPath);
    console.log(`  ✓ [${agentId}] ${skillName} → ${targetPath}`);
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
    console.log(`  ↺ [${agentId}] ${skillName} (replaced stale symlink)`);
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
