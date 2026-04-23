import { copyFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

export async function backupIfExists(filePath: string): Promise<string | null> {
  if (!existsSync(filePath)) return null;

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${filePath}.backup-${timestamp}`;
  copyFileSync(filePath, backupPath);
  return backupPath;
}

export function ensureParentDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}
