import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { findConfigFile, loadConfig } from './config.ts';
import { LetterpressError } from './errors.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'letterpress-config-'));
  mkdirSync(path.join(root, 'posts'));
  mkdirSync(path.join(root, 'public'));
  writeFileSync(path.join(root, 'site.css'), 'body {}');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('findConfigFile', () => {
  test('finds letterpress.json in a parent directory', () => {
    const file = path.join(root, 'letterpress.json');
    writeFileSync(file, '{}');
    expect(findConfigFile(path.join(root, 'posts'))).toBe(file);
  });

  test('returns undefined when no ancestor has one', () => {
    expect(findConfigFile(path.join(root, 'posts'))).toBeUndefined();
  });
});

function writeConfig(values: Record<string, unknown>): string {
  const file = path.join(root, 'letterpress.json');
  writeFileSync(file, JSON.stringify(values));
  return file;
}

const valid = {
  stylesheet: 'site.css',
  staticRoot: 'public',
  bodyClass: 'prose',
  lightClass: 'light',
};

describe('loadConfig', () => {
  test('resolves paths against the config directory', () => {
    expect(loadConfig(writeConfig(valid))).toEqual({
      root,
      stylesheet: path.join(root, 'site.css'),
      staticRoot: path.join(root, 'public'),
      bodyClass: 'prose',
      lightClass: 'light',
    });
  });

  test.each(['stylesheet', 'staticRoot', 'bodyClass', 'lightClass'])(
    'rejects a missing %s',
    (key) => {
      const { [key]: _omitted, ...rest } = valid as Record<string, string>;
      const file = writeConfig(rest);
      expect(() => loadConfig(file)).toThrow(new LetterpressError(`${file} is missing "${key}"`));
    },
  );

  test.each(['stylesheet', 'staticRoot', 'bodyClass', 'lightClass'])(
    'rejects an empty %s',
    (key) => {
      const file = writeConfig({ ...valid, [key]: '' });
      expect(() => loadConfig(file)).toThrow(new LetterpressError(`${file} is missing "${key}"`));
    },
  );

  test('rejects a stylesheet path that does not exist', () => {
    const file = writeConfig({ ...valid, stylesheet: 'nope.css' });
    expect(() => loadConfig(file)).toThrow(
      `stylesheet does not exist: ${path.join(root, 'nope.css')}`,
    );
  });

  test('rejects a staticRoot that is not a directory', () => {
    const file = writeConfig({ ...valid, staticRoot: 'site.css' });
    expect(() => loadConfig(file)).toThrow(
      `staticRoot does not exist: ${path.join(root, 'site.css')}`,
    );
  });

  test('rejects invalid JSON', () => {
    const file = path.join(root, 'letterpress.json');
    writeFileSync(file, '{');
    expect(() => loadConfig(file)).toThrow(LetterpressError);
    expect(() => loadConfig(file)).toThrow(`${file} is not valid JSON:`);
  });

  test.each([
    ['string', '"text"'],
    ['null', 'null'],
  ])('rejects a top-level %s', (_kind, json) => {
    const file = path.join(root, 'letterpress.json');
    writeFileSync(file, json);
    expect(() => loadConfig(file)).toThrow(
      new LetterpressError(`${file} must contain a JSON object`),
    );
  });
});
