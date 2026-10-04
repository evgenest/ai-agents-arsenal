import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diffLockEntry, diffLocks, findLockEntry, readSkillLock, skillLockPath, uncheckableReason } from "./skills-lock";

describe("skillLockPath", () => {
  test("uses ~/.agents/.skill-lock.json without XDG_STATE_HOME", () => {
    expect(skillLockPath({}, "/home/u")).toBe("/home/u/.agents/.skill-lock.json");
  });

  test("prefers $XDG_STATE_HOME/skills/.skill-lock.json", () => {
    expect(skillLockPath({ XDG_STATE_HOME: "/state" }, "/home/u")).toBe("/state/skills/.skill-lock.json");
  });
});

describe("lockfile diff", () => {
  const before = {
    same: { source: "o/r", skillFolderHash: "aaa" },
    changed: { source: "o/r", skillFolderHash: "bbb" },
    removed: { source: "o/r", skillFolderHash: "ccc" },
  };
  const after = {
    same: { source: "o/r", skillFolderHash: "aaa" },
    changed: { source: "o/r", skillFolderHash: "bbb2" },
    added: { source: "o/r", skillFolderHash: "ddd" },
  };

  test("classifies each skill", () => {
    expect(diffLocks(before, after)).toEqual({
      added: "installed",
      changed: "updated",
      removed: "absent",
      same: "unchanged",
    });
  });

  test("a hash appearing where there was none counts as updated", () => {
    expect(diffLockEntry({ x: { skillFolderHash: "" } }, { x: { skillFolderHash: "h" } }, "x")).toBe("updated");
  });

  test("readSkillLock treats missing, malformed and pre-v3 files as empty", async () => {
    const dir = await mkdtemp(join(tmpdir(), "arsenal-lock-"));
    try {
      expect(await readSkillLock(join(dir, "nope.json"))).toEqual({});
      await writeFile(join(dir, "bad.json"), "{not json");
      expect(await readSkillLock(join(dir, "bad.json"))).toEqual({});
      await writeFile(join(dir, "old.json"), JSON.stringify({ version: 2, skills: { a: {} } }));
      expect(await readSkillLock(join(dir, "old.json"))).toEqual({});
      await writeFile(join(dir, "ok.json"), JSON.stringify({ version: 3, skills: { a: { skillFolderHash: "h" } } }));
      expect(await readSkillLock(join(dir, "ok.json"))).toEqual({ a: { skillFolderHash: "h" } });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("uncheckableReason", () => {
  test("a skill with a hash and a path can be checked", () => {
    expect(uncheckableReason({ source: "o/r", skillFolderHash: "h", skillPath: "skills/a/SKILL.md" })).toBeNull();
  });

  test("a well-known source with a digest can be checked without a hash", () => {
    expect(uncheckableReason({ sourceType: "well-known", sourceBaseUrl: "https://x", wellKnownDigest: "d" })).toBeNull();
  });

  test("names the reason the skills CLI would skip it for", () => {
    expect(uncheckableReason(undefined)).toBe("not tracked in the skills CLI lockfile");
    expect(uncheckableReason({ sourceType: "github", skillPath: "a/SKILL.md" })).toBe("Private or deleted repo");
    expect(uncheckableReason({ sourceType: "github", skillFolderHash: "h" })).toBe("No skill path recorded");
    expect(uncheckableReason({ sourceType: "local", skillFolderHash: "h" })).toBe("Local path");
    expect(uncheckableReason({ sourceType: "git" })).toBe("Git URL");
  });

  test("findLockEntry matches names case-insensitively, like `skills update <names>`", () => {
    const lock = { "Find-Skills": { skillFolderHash: "h" } };
    expect(findLockEntry(lock, "find-skills")).toEqual({ skillFolderHash: "h" });
    expect(findLockEntry(lock, "other")).toBeUndefined();
  });
});
