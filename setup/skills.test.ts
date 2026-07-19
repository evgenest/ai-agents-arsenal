import { describe, expect, test } from "bun:test";
import { stripAnsi } from "./skills";

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
