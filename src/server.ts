import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
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
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

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
      if (!address || typeof address === 'string') {
        reject(new Error('Server did not get a port'));
        return;
      }
      resolve({
        port: address.port,
        close: () =>
          new Promise<void>((done, fail) => server.close((err) => (err ? fail(err) : done()))),
      });
    });
  });
}

async function handle(
  opts: ServerOptions,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  if (req.method !== 'GET') return notFound(res);
  if (pathname === '/config') {
    return sendJson(res, { bodyClass: opts.config.bodyClass, lightClass: opts.config.lightClass });
  }
  if (pathname === '/') return sendFile(res, path.join(opts.pageDir, 'index.html'));
  if (pathname === '/main.js') return sendFile(res, path.join(opts.pageDir, 'main.js'));
  if (pathname === '/site.css') return sendFile(res, opts.config.stylesheet);
  const file = resolveStatic(opts.config.staticRoot, pathname);
  return file ? sendFile(res, file) : notFound(res);
}

/** Maps a URL path onto the static root, refusing anything that escapes it. */
function resolveStatic(root: string, pathname: string): string | null {
  const file = path.resolve(root, `.${decodeURIComponent(pathname)}`);
  return file.startsWith(root + path.sep) ? file : null;
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
