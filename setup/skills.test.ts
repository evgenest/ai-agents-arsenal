import { describe, expect, test } from "bun:test";
import { stripAnsi, extractErrorDetails } from "./skills";

describe("stripAnsi", () => {
  test("removes standard colors and styles", () => {
    const input = "\u001b[31mRed Text\u001b[0m \u001b[1mBold Text\u001b[m";
    expect(stripAnsi(input)).toBe("Red Text Bold Text");
  });

  test("handles 256-color and 24-bit color sequences", () => {
    const input = "\u001b[38;5;250mGray Text\u001b[0m";
    expect(stripAnsi(input)).toBe("Gray Text");
  });

  test("leaves plain text untouched", () => {
    const input = "This is some plain text.";
    expect(stripAnsi(input)).toBe("This is some plain text.");
  });
});

describe("extractErrorDetails", () => {
  test("skips the large skills logo and empty lines, preserving the real error output", () => {
    const logoAndError = `
███████╗██╗  ██╗██╗██╗     ██╗     ███████╗
██╔════╝██║ ██╔╝██║██║     ██║     ██╔════╝
███████╗█████╔╝ ██║██║     ██║     ███████╗
╚════██║██╔═██╗ ██║██║     ██║     ╚════██║
███████║██║  ██╗██║███████╗███████╗███████║
╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚══════╝

┌   skills
│
◇  Source: https://github.com/vercel-labs/next-skills.git
│
◇  Falling back to clone…
│
◇  Repository cloned
│
◇  No skills found
│
└  No valid skills found. Skills require a SKILL.md with name and description.
`;

    const expected = `┌   skills
│
◇  Source: https://github.com/vercel-labs/next-skills.git
│
◇  Falling back to clone…
│
◇  Repository cloned
│
◇  No skills found
│
└  No valid skills found. Skills require a SKILL.md with name and description.`;

    expect(extractErrorDetails(logoAndError)).toBe(expected);
  });

  test("handles output without logo perfectly", () => {
    const errorOnly = `Some other standard error message
on multiple lines
with some detail`;
    expect(extractErrorDetails(errorOnly)).toBe(errorOnly);
  });

  test("handles empty string input", () => {
    expect(extractErrorDetails("")).toBe("");
  });
});
