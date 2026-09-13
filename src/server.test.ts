import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { Config } from './config.ts';
import { startServer, type RunningServer } from './server.ts';

let root: string;
let postPath: string;
let server: RunningServer;
let base: string;

beforeEach(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'letterpress-server-'));
  const site = path.join(root, 'site');
  const pageDir = path.join(root, 'page');
  mkdirSync(path.join(site, 'public', 'fonts'), { recursive: true });
  mkdirSync(path.join(site, 'posts'));
  mkdirSync(pageDir);
  writeFileSync(path.join(site, 'site.css'), 'body { color: red }');
  writeFileSync(path.join(site, 'public', 'fonts', 'a.woff2'), 'font-bytes');
  writeFileSync(path.join(root, 'secret.txt'), 'secret');
  writeFileSync(path.join(pageDir, 'index.html'), '<title>Letterpress</title>');
  writeFileSync(path.join(pageDir, 'main.js'), 'console.log(1)');
  postPath = path.join(site, 'posts', 'a.md');
  writeFileSync(postPath, '---\ntitle: a\n---\nBody\n');
  const config: Config = {
    root: site,
    stylesheet: path.join(site, 'site.css'),
    staticRoot: path.join(site, 'public'),
    bodyClass: 'prose',
    lightClass: 'light',
  };
  server = await startServer({ config, postPath, pageDir });
  base = `http://127.0.0.1:${server.port}`;
});

afterEach(async () => {
  await server.close();
  rmSync(root, { recursive: true, force: true });
});

describe('static routes', () => {
  test('serves the editor page at /', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await res.text()).toBe('<title>Letterpress</title>');
  });

  test('serves the bundle at /main.js', async () => {
    const res = await fetch(`${base}/main.js`);
    expect(res.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(await res.text()).toBe('console.log(1)');
  });

  test('serves the site stylesheet at /site.css', async () => {
    const res = await fetch(`${base}/site.css`);
    expect(res.headers.get('content-type')).toBe('text/css; charset=utf-8');
    expect(await res.text()).toBe('body { color: red }');
  });

  test('serves files under the static root', async () => {
    const res = await fetch(`${base}/fonts/a.woff2`);
    expect(res.headers.get('content-type')).toBe('font/woff2');
    expect(await res.text()).toBe('font-bytes');
  });

  test('returns 404 for a missing file', async () => {
    expect((await fetch(`${base}/nope.png`)).status).toBe(404);
  });

  test('refuses paths that escape the static root', async () => {
    expect((await fetch(`${base}/..%2F..%2Fsecret.txt`)).status).toBe(404);
  });

  test('returns only the classes at /config', async () => {
    const res = await fetch(`${base}/config`);
    expect(await res.json()).toEqual({ bodyClass: 'prose', lightClass: 'light' });
  });
});
