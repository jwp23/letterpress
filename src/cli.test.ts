import { execFile } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { isOnPath, main, runCli } from './cli.ts';
import { LetterpressError } from './errors.ts';
import type { RunningServer } from './server.ts';

const run = promisify(execFile);
const bin = path.resolve('bin/letterpress.js');

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'letterpress-cli-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function runSubprocess(...args: string[]): Promise<{ code: number; stderr: string }> {
  try {
    await run(process.execPath, [bin, ...args]);
    return { code: 0, stderr: '' };
  } catch (err) {
    const failure = err as { code: number; stderr: string };
    return { code: failure.code, stderr: failure.stderr };
  }
}

describe('letterpress CLI (subprocess, exit codes)', () => {
  test('prints usage without a post', async () => {
    expect(await runSubprocess()).toEqual({ code: 1, stderr: 'Usage: letterpress <post.md>\n' });
  });

  test('reports a missing post', async () => {
    const post = path.join(dir, 'nope.md');
    expect(await runSubprocess(post)).toEqual({ code: 1, stderr: `Post not found: ${post}\n` });
  });

  test('reports a missing config', async () => {
    const post = path.join(dir, 'a.md');
    writeFileSync(post, 'Body\n');
    expect(await runSubprocess(post)).toEqual({
      code: 1,
      stderr: `No letterpress.json found above ${post}\n`,
    });
  });
});

describe('isOnPath', () => {
  test('finds an executable in a directory on the given PATH', () => {
    const exe = path.join(dir, 'my-tool');
    writeFileSync(exe, '#!/bin/sh\n');
    chmodSync(exe, 0o755);
    expect(isOnPath('my-tool', dir)).toBe(true);
  });

  test('is false for a command missing from the given PATH', () => {
    expect(isOnPath('no-such-tool', dir)).toBe(false);
  });

  test('treats an unset PATH as empty', () => {
    const original = process.env.PATH;
    delete process.env.PATH;
    try {
      expect(isOnPath('no-such-letterpress-tool')).toBe(false);
    } finally {
      process.env.PATH = original;
    }
  });
});

/** Builds a site with a valid letterpress.json and post; returns the post path. */
function buildSite(root: string): string {
  const site = path.join(root, 'site');
  mkdirSync(path.join(site, 'public'), { recursive: true });
  writeFileSync(path.join(site, 'site.css'), 'body {}');
  writeFileSync(
    path.join(site, 'letterpress.json'),
    JSON.stringify({
      stylesheet: 'site.css',
      staticRoot: 'public',
      bodyClass: 'prose',
      lightClass: 'light',
    }),
  );
  const postPath = path.join(site, 'a.md');
  writeFileSync(postPath, '---\ntitle: a\n---\nBody\n');
  return postPath;
}

describe('main (in-process)', () => {
  test('rejects with usage when no post is given', async () => {
    await expect(main([])).rejects.toThrow(new LetterpressError('Usage: letterpress <post.md>'));
  });

  test('rejects when the post does not exist', async () => {
    const post = path.join(dir, 'nope.md');
    await expect(main([post])).rejects.toThrow(new LetterpressError(`Post not found: ${post}`));
  });

  test('rejects when no letterpress.json is found', async () => {
    const post = path.join(dir, 'a.md');
    writeFileSync(post, 'Body\n');
    await expect(main([post])).rejects.toThrow(
      new LetterpressError(`No letterpress.json found above ${post}`),
    );
  });

  test('rejects when the editor bundle is missing', async () => {
    const postPath = buildSite(dir);
    const pageDir = path.join(dir, 'page');
    mkdirSync(pageDir);
    await expect(main([postPath], { pageDir, openBrowser: vi.fn() })).rejects.toThrow(
      new LetterpressError('Editor bundle is missing; run npm run build first'),
    );
  });

  test('starts the server, opens a browser, and logs the URL', async () => {
    const postPath = buildSite(dir);
    const pageDir = path.join(dir, 'page');
    mkdirSync(pageDir);
    writeFileSync(path.join(pageDir, 'index.html'), '<title>Letterpress</title>');
    writeFileSync(path.join(pageDir, 'main.js'), 'console.log(1)');
    const openBrowser = vi.fn();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    let server: RunningServer | undefined;
    try {
      server = await main([postPath], { pageDir, openBrowser });
      const url = `http://127.0.0.1:${server.port}/`;
      expect(openBrowser).toHaveBeenCalledWith(url);
      expect(log).toHaveBeenCalledWith(`Letterpress: ${postPath}\n${url}\nPress Ctrl+C to stop.`);
    } finally {
      log.mockRestore();
      await server?.close();
    }
  });
});

describe('runCli', () => {
  test('closes the server and exits 0 on Ctrl+C', async () => {
    const postPath = buildSite(dir);
    const pageDir = path.join(dir, 'page');
    mkdirSync(pageDir);
    writeFileSync(path.join(pageDir, 'main.js'), 'console.log(1)');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const before = new Set(process.listeners('SIGINT'));
    const exited = new Promise<number | undefined>((resolve) => {
      vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
        resolve(code);
      }) as typeof process.exit);
    });
    try {
      await runCli([postPath], { pageDir, openBrowser: vi.fn() });
      const added = process.listeners('SIGINT').filter((listener) => !before.has(listener));
      expect(added).toHaveLength(1);
      added[0]('SIGINT');
      expect(await exited).toBe(0);
      process.removeListener('SIGINT', added[0]);
    } finally {
      vi.restoreAllMocks();
      log.mockRestore();
    }
  });

  test('rethrows errors that are not LetterpressErrors', async () => {
    const postPath = buildSite(dir);
    const boom = new Error('boom');
    const deps = {
      get pageDir(): string {
        throw boom;
      },
      openBrowser: vi.fn(),
    };
    await expect(runCli([postPath], deps)).rejects.toBe(boom);
  });

  test('maps a LetterpressError to stderr and exit code 1', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const originalExitCode = process.exitCode;
    try {
      await runCli([]);
      expect(error).toHaveBeenCalledWith('Usage: letterpress <post.md>');
      expect(process.exitCode).toBe(1);
    } finally {
      error.mockRestore();
      process.exitCode = originalExitCode;
    }
  });
});
