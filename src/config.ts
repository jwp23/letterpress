import { existsSync } from 'node:fs';
import path from 'node:path';

export const CONFIG_FILENAME = 'letterpress.json';

/** Walks up from startDir and returns the first letterpress.json found. */
export function findConfigFile(startDir: string): string | undefined {
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, CONFIG_FILENAME);
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}
