/**
 * Error-text helpers shared by every skills code path: the normal console
 * summary, the `--report` JSON, and the `skills` CLI self-update step.
 */

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
    const line = lines[startIndex]!;
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

/** Best human-readable text for a thrown value, preferring a ShellError's captured output. */
export function describeError(err: unknown): string {
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
  return details;
}

/** Splits raw child output into clean lines: ANSI stripped, `\r` progress rewrites expanded. */
export function cleanLines(raw: string): string[] {
  return stripAnsi(raw).split(/\r\n|\r|\n/);
}
