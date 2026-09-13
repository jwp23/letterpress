import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

const run = promisify(execFile);
const bin = path.resolve('bin/letterpress.js');

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'letterpress-cli-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function runCli(...args: string[]): Promise<{ code: number; stderr: string }> {
  try {
    await run(process.execPath, [bin, ...args]);
    return { code: 0, stderr: '' };
  } catch (err) {
    const failure = err as { code: number; stderr: string };
    return { code: failure.code, stderr: failure.stderr };
  }
}

describe('letterpress CLI', () => {
  test('prints usage without a post', async () => {
    expect(await runCli()).toEqual({ code: 1, stderr: 'Usage: letterpress <post.md>\n' });
  });

  test('reports a missing post', async () => {
    const post = path.join(dir, 'nope.md');
    expect(await runCli(post)).toEqual({ code: 1, stderr: `Post not found: ${post}\n` });
  });

  test('reports a missing config', async () => {
    const post = path.join(dir, 'a.md');
    writeFileSync(post, 'Body\n');
    expect(await runCli(post)).toEqual({
      code: 1,
      stderr: `No letterpress.json found above ${post}\n`,
    });
  });
});
