import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { LetterpressError } from './errors.ts';

export const CONFIG_FILENAME = 'letterpress.json';

export interface Config {
  /** Directory holding letterpress.json; every path resolves against it. */
  root: string;
  /** Absolute path of the site's stylesheet. */
  stylesheet: string;
  /** Absolute path of the directory served at `/`. */
  staticRoot: string;
  /** Class the site puts on the rendered post body. */
  bodyClass: string;
  /** Class the site puts on <html> for light mode. */
  lightClass: string;
}

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

const STRING_KEYS = ['stylesheet', 'staticRoot', 'bodyClass', 'lightClass'] as const;

/** Reads and validates letterpress.json, resolving its paths. */
export function loadConfig(configPath: string): Config {
  let raw: unknown;
  try {
    // Stryker disable next-line StringLiteral: with no encoding readFileSync returns a Buffer, which JSON.parse decodes as the same UTF-8 text
    raw = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (err) {
    throw new LetterpressError(`${configPath} is not valid JSON: ${(err as Error).message}`);
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new LetterpressError(`${configPath} must contain a JSON object`);
  }
  const values = raw as Record<string, unknown>;
  for (const key of STRING_KEYS) {
    if (typeof values[key] !== 'string' || values[key] === '') {
      throw new LetterpressError(`${configPath} is missing "${key}"`);
    }
  }
  const root = path.dirname(configPath);
  const stylesheet = path.resolve(root, values.stylesheet as string);
  const staticRoot = path.resolve(root, values.staticRoot as string);
  if (!isFile(stylesheet)) throw new LetterpressError(`stylesheet does not exist: ${stylesheet}`);
  if (!isDirectory(staticRoot))
    throw new LetterpressError(`staticRoot does not exist: ${staticRoot}`);
  return {
    root,
    stylesheet,
    staticRoot,
    bodyClass: values.bodyClass as string,
    lightClass: values.lightClass as string,
  };
}

function isFile(p: string): boolean {
  return existsSync(p) && statSync(p).isFile();
}

function isDirectory(p: string): boolean {
  return existsSync(p) && statSync(p).isDirectory();
}
