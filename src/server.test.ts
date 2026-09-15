import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { Config } from './config.ts';
import { startServer, type RunningServer, type ServerOptions } from './server.ts';

let root: string;
let pageDir: string;
let postPath: string;
let options: ServerOptions;
let server: RunningServer;
let base: string;

beforeEach(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'letterpress-server-'));
  const site = path.join(root, 'site');
  pageDir = path.join(root, 'page');
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
  options = { config, postPath, pageDir };
  server = await startServer(options);
  base = `http://127.0.0.1:${server.port}`;
});

afterEach(async () => {
  await server.close();
  chmodSync(path.dirname(postPath), 0o755);
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

  test('refuses symlinks under the static root that point outside it', async () => {
    symlinkSync(path.join(root, 'secret.txt'), path.join(root, 'site', 'public', 'leak.txt'));
    expect((await fetch(`${base}/leak.txt`)).status).toBe(404);
  });

  test('returns 404 for a malformed percent-encoding', async () => {
    expect((await fetch(`${base}/%E0%A4%A`)).status).toBe(404);
  });

  test('returns only the classes at /config', async () => {
    const res = await fetch(`${base}/config`);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.json()).toEqual({ bodyClass: 'prose', lightClass: 'light' });
  });

  test('returns 404 for non-GET requests', async () => {
    expect((await fetch(`${base}/`, { method: 'POST' })).status).toBe(404);
  });

  test('returns 404 for a directory under the static root', async () => {
    expect((await fetch(`${base}/fonts`)).status).toBe(404);
  });

  test('returns 404 when a page asset is missing', async () => {
    rmSync(path.join(pageDir, 'main.js'));
    expect((await fetch(`${base}/main.js`)).status).toBe(404);
  });

  test('serves unknown file types as octet-stream', async () => {
    writeFileSync(path.join(root, 'site', 'public', 'blob.dat'), 'bytes');
    const res = await fetch(`${base}/blob.dat`);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(await res.text()).toBe('bytes');
  });

  test('reports a file it cannot read', async () => {
    const locked = path.join(root, 'site', 'public', 'locked.txt');
    writeFileSync(locked, 'x');
    chmodSync(locked, 0o000);
    const res = await fetch(`${base}/locked.txt`);
    expect(res.status).toBe(500);
    expect(await res.text()).toContain('EACCES');
  });
});

describe('/post', () => {
  test('GET returns the file text', async () => {
    const res = await fetch(`${base}/post`);
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await res.text()).toBe('---\ntitle: a\n---\nBody\n');
  });

  test('PUT writes the file and leaves no temp file', async () => {
    const res = await fetch(`${base}/post`, { method: 'PUT', body: '---\ntitle: b\n---\nNew\n' });
    expect(res.status).toBe(204);
    expect(readFileSync(postPath, 'utf8')).toBe('---\ntitle: b\n---\nNew\n');
    expect(readdirSync(path.dirname(postPath))).toEqual(['a.md']);
  });

  test('PUT reports a failed write and leaves the file intact', async () => {
    chmodSync(path.dirname(postPath), 0o500);
    const res = await fetch(`${base}/post`, { method: 'PUT', body: 'changed' });
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await res.text()).toContain('EACCES');
    expect(readFileSync(postPath, 'utf8')).toBe('---\ntitle: a\n---\nBody\n');
  });

  test('rejects other methods', async () => {
    expect((await fetch(`${base}/post`, { method: 'DELETE' })).status).toBe(405);
  });
});

describe('startServer', () => {
  test('rejects when the port is already in use', async () => {
    await expect(startServer({ ...options, port: server.port })).rejects.toThrow('EADDRINUSE');
  });

  test('listens on loopback only', async () => {
    await expect(fetch(`http://[::1]:${server.port}/`)).rejects.toThrow();
  });
});
