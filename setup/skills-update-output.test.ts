import { describe, expect, test } from "bun:test";
import { parseUpdateOutput } from "./skills-update-output";

const DIM = "\u001b[38;5;102m";
const TEXT = "\u001b[38;5;145m";
const RESET = "\u001b[0m";

describe("parseUpdateOutput", () => {
  test("parses per-skill lines from ANSI-colored `skills update` output", () => {
    const raw = [
      `${TEXT}Checking for skill updates…${RESET}`,
      "",
      `\r${DIM}Checking skills from source: obra/superpowers${RESET}\u001b[K`,
      `\r${DIM}Checking skills from source: broken/repo${RESET}\u001b[K`,
      `  ${DIM}✗ Failed to check skills from broken/repo${RESET}`,
      "\r\u001b[K" + `${TEXT}Found 3 global update(s)${RESET}`,
      "",
      `${TEXT}Updating brainstorming…${RESET}`,
      `  ${TEXT}✓${RESET} Updated brainstorming`,
      `${TEXT}Updating writing-plans…${RESET}`,
      `  ${DIM}✗ Failed to update writing-plans${RESET}`,
      `  ${DIM}✗ Cannot update odd-one: lock file is missing sourceUrl for this generic Git source${RESET}`,
      `  ${DIM}✗ Failed to update other: CLI entrypoint not found at /x/bin/cli.mjs${RESET}`,
      `  ${DIM}✗ CLI entrypoint not found at /x/bin/cli.mjs${RESET}`,
      "",
      `${TEXT}✓ Updated 1 skill(s)${RESET}`,
      `${DIM}Failed to update 3 skill(s)${RESET}`,
    ].join("\n");

    const parsed = parseUpdateOutput(raw);
    expect(parsed.updated).toEqual(["brainstorming"]);
    expect(parsed.failed.map((f) => f.name)).toEqual(["writing-plans", "odd-one", "other"]);
    expect(parsed.failed[1]!.line).toBe("✗ Cannot update odd-one: lock file is missing sourceUrl for this generic Git source");
    expect(parsed.sourceFailures).toEqual([{ source: "broken/repo", line: "✗ Failed to check skills from broken/repo" }]);
    expect(parsed.otherFailures).toEqual(["✗ CLI entrypoint not found at /x/bin/cli.mjs"]);
  });

  test("an up-to-date run yields nothing", () => {
    const parsed = parseUpdateOutput(`${TEXT}✓ All global skills are up to date${RESET}\n`);
    expect(parsed).toEqual({ updated: [], failed: [], sourceFailures: [], otherFailures: [], warnings: [] });
  });
});

describe("parseUpdateOutput warnings", () => {
  test("keeps the deleted-upstream block whole and names its skills", () => {
    // Exactly what cli.mjs promptDeletions prints with -y.
    const raw = [
      `\r${DIM}Checking skills from source: owner/repo${RESET}\u001b[K`,
      `  ${DIM}Skill paths changed; resolving via Git clone${RESET}`,
      "",
      `${DIM}Warning:${RESET} The following skills from ${DIM}owner/repo${RESET} appear to have been deleted upstream:`,
      `  ${DIM}•${RESET} ghost-skill`,
      `  ${DIM}•${RESET} other-ghost`,
      `${DIM}Skipping deletion in non-interactive mode.${RESET}`,
      "\r\u001b[K" + `${TEXT}✓ All global skills are up to date${RESET}`,
    ].join("\n");

    const { warnings, otherFailures, failed } = parseUpdateOutput(raw);
    expect(warnings).toEqual([{
      text: "Warning: The following skills from owner/repo appear to have been deleted upstream:\n"
        + "  • ghost-skill\n  • other-ghost\nSkipping deletion in non-interactive mode.",
      names: ["ghost-skill", "other-ghost"],
    }]);
    expect(otherFailures).toEqual([]);
    expect(failed).toEqual([]);
  });

  test("keeps the ambiguous-paths block", () => {
    const raw = [
      "",
      `${DIM}Warning:${RESET} Multiple current paths match these skills from ${DIM}o/r${RESET}; skipping them rather than deleting or migrating the wrong skill:`,
      `  ${DIM}•${RESET} twin`,
      "",
    ].join("\n");
    const { warnings } = parseUpdateOutput(raw);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.names).toEqual(["twin"]);
    expect(warnings[0]!.text).toStartWith("Warning: Multiple current paths match these skills from o/r;");
  });

  test("keeps the cannot-be-checked list with its To update lines and splits grouped names", () => {
    const raw = [
      `  ${TEXT}✓${RESET} Updated fresh`,
      "",
      `${DIM}2 skill(s) cannot be checked automatically:${RESET}`,
      `  ${TEXT}•${RESET} a, b ${DIM}(Private or deleted repo)${RESET}`,
      `    ${DIM}To update: ${TEXT}npx skills add o/r -g -y${RESET}`,
      `  ${TEXT}•${RESET} c ${DIM}(No skill path recorded)${RESET}`,
      `    ${DIM}To update: ${TEXT}npx skills add o/s -g -y${RESET}`,
      "",
      `${TEXT}✓ Updated 1 skill(s)${RESET}`,
    ].join("\n");
    const parsed = parseUpdateOutput(raw);
    expect(parsed.updated).toEqual(["fresh"]);
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.warnings[0]!.names).toEqual(["a", "b", "c"]);
    expect(parsed.warnings[0]!.text).toContain("To update: npx skills add o/s -g -y");
    expect(parsed.warnings[0]!.text.split("\n")).toHaveLength(5);
  });

  test("a status line right after a block is not swallowed into it", () => {
    const raw = [
      "Warning: The following skills from o/r appear to have been deleted upstream:",
      "  • gone",
      "  ✗ Failed to update other",
    ].join("\n");
    const parsed = parseUpdateOutput(raw);
    expect(parsed.warnings[0]!.names).toEqual(["gone"]);
    expect(parsed.failed.map((f) => f.name)).toEqual(["other"]);
  });
});
