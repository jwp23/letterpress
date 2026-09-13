import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { findConfigFile } from './config.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'letterpress-config-'));
  mkdirSync(path.join(root, 'posts'));
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
