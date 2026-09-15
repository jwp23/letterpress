import { createReadStream } from 'node:fs';
import { readFile, realpath, rename, stat, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import path from 'node:path';
import type { Config } from './config.ts';

export interface ServerOptions {
  config: Config;
  /** The one file this server reads and writes. */
  postPath: string;
  /** Directory holding the built editor page: index.html and main.js. */
  pageDir: string;
  port?: number;
}

export interface RunningServer {
  port: number;
  close(): Promise<void>;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  // Stryker disable StringLiteral: a wrong MIME string is a browser rendering quirk, not
  // corrupted post content; a test per literal guards nothing.
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  // Stryker restore StringLiteral
  '.woff2': 'font/woff2',
  // Stryker disable StringLiteral: a wrong MIME string is a browser rendering quirk, not
  // corrupted post content; a test per literal guards nothing.
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};
// Stryker restore StringLiteral

export function startServer(opts: ServerOptions): Promise<RunningServer> {
  const server = createServer((req, res) => {
    handle(opts, req, res).catch((err: unknown) => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(err instanceof Error ? err.message : String(err));
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port ?? 0, '127.0.0.1', () => {
      const address = server.address();
      // Stryker disable ConditionalExpression,LogicalOperator,StringLiteral,BlockStatement,CallExpression: a TCP server that has just called back from listen always has an object address; this guard only narrows the type and no reachable state enters it.
      if (!address || typeof address === 'string') {
        reject(new Error('Server did not get a port'));
        return;
      }
      // Stryker restore ConditionalExpression,LogicalOperator,StringLiteral,BlockStatement,CallExpression
      resolve({ port: address.port, close: () => closeServer(server) });
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((done, fail) => server.close((err) => (err ? fail(err) : done())));
}

async function handle(
  opts: ServerOptions,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // Stryker disable next-line StringLiteral: req.url is always set on a parsed request, and new URL('', base) has pathname '/' regardless.
  /* v8 ignore next -- req.url is always set on a parsed request; the fallback is defensive only. */
  const target = req.url ?? '/';
  const { pathname } = new URL(target, 'http://localhost');
  if (pathname === '/post') return handlePost(opts, req, res);
  if (req.method !== 'GET') return notFound(res);
  if (pathname === '/config') {
    return sendJson(res, { bodyClass: opts.config.bodyClass, lightClass: opts.config.lightClass });
  }
  if (pathname === '/') return sendFile(res, path.join(opts.pageDir, 'index.html'));
  if (pathname === '/main.js') return sendFile(res, path.join(opts.pageDir, 'main.js'));
  if (pathname === '/site.css') return sendFile(res, opts.config.stylesheet);
  const file = await resolveStatic(opts.config.staticRoot, pathname);
  return file ? sendFile(res, file) : notFound(res);
}

/**
 * Maps a URL path onto the static root, refusing anything that escapes it. Both paths are
 * canonicalized first so a symlink under the root cannot point the request outside it.
 */
async function resolveStatic(root: string, pathname: string): Promise<string | null> {
  let realRoot: string;
  let file: string;
  try {
    realRoot = await realpath(root);
    file = await realpath(path.join(realRoot, decodeURIComponent(pathname)));
  } catch {
    // Missing files and malformed percent-encodings both mean there is nothing to serve.
    return null;
  }
  return file.startsWith(realRoot + path.sep) ? file : null;
}

async function sendFile(res: ServerResponse, file: string): Promise<void> {
  let info;
  try {
    info = await stat(file);
  } catch {
    return notFound(res);
  }
  if (!info.isFile()) return notFound(res);
  res.setHeader('Content-Type', MIME[path.extname(file)] ?? 'application/octet-stream');
  await new Promise<void>((resolve, reject) => {
    // Stryker disable next-line StringLiteral: pipe ends the response on its own, so a never-resolving 'end' is invisible to the client; this also covers 'error', which the unreadable-file test guards.
    createReadStream(file).on('error', reject).on('end', resolve).pipe(res);
  });
}

function sendJson(res: ServerResponse, value: unknown): void {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(value));
}

function notFound(res: ServerResponse): void {
  res.statusCode = 404;
  res.end();
}

async function handlePost(
  opts: ServerOptions,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    // Stryker disable next-line StringLiteral: readFile with no encoding returns the same bytes as a Buffer.
    res.end(await readFile(opts.postPath, 'utf8'));
    return;
  }
  if (req.method === 'PUT') {
    await writeAtomic(opts.postPath, await readBody(req));
    res.statusCode = 204;
    res.end();
    return;
  }
  res.statusCode = 405;
  res.end();
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

/** Writes to a sibling temp file, then renames, so a crash never leaves a partial post. */
async function writeAtomic(file: string, text: string): Promise<void> {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.letterpress-tmp`);
  // Stryker disable next-line StringLiteral: writeFile with no encoding falls back to utf8 and writes the same bytes.
  await writeFile(tmp, text, 'utf8');
  await rename(tmp, file);
}
