import { spawn } from 'node:child_process';
import { accessSync, constants, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserCommand } from './browser.ts';
import { findConfigFile, loadConfig } from './config.ts';
import { LetterpressError } from './errors.ts';
import { startServer, type RunningServer } from './server.ts';

/** True when cmd is an executable file in some directory on pathEnv. */
export function isOnPath(cmd: string, pathEnv = process.env.PATH ?? ''): boolean {
  return pathEnv.split(path.delimiter).some((dir) => {
    try {
      accessSync(path.join(dir, cmd), constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

function openBrowser(url: string): void {
  const { cmd, args } = browserCommand(url, isOnPath);
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
}

export interface CliDeps {
  /** Directory holding the built editor page: index.html and main.js. */
  pageDir: string;
  openBrowser: (url: string) => void;
}

const defaultDeps: CliDeps = {
  pageDir: fileURLToPath(new URL('../dist/client/', import.meta.url)),
  openBrowser,
};

/** Starts the editor server for argv[0] and opens a browser onto it; returns the running server. */
export async function main(argv: string[], deps: CliDeps = defaultDeps): Promise<RunningServer> {
  const arg = argv[0];
  if (!arg) throw new LetterpressError('Usage: letterpress <post.md>');
  const postPath = path.resolve(arg);
  if (!existsSync(postPath)) throw new LetterpressError(`Post not found: ${postPath}`);
  const configPath = findConfigFile(path.dirname(postPath));
  if (!configPath) throw new LetterpressError(`No letterpress.json found above ${postPath}`);
  const config = loadConfig(configPath);
  const { pageDir } = deps;
  if (!existsSync(path.join(pageDir, 'main.js'))) {
    throw new LetterpressError('Editor bundle is missing; run npm run build first');
  }
  const server = await startServer({ config, postPath, pageDir });
  const url = `http://127.0.0.1:${server.port}/`;
  deps.openBrowser(url);
  console.log(`Letterpress: ${postPath}\n${url}\nPress Ctrl+C to stop.`);
  return server;
}

/** Entry point: runs main, mapping a LetterpressError to stderr and exit code 1. */
export async function runCli(argv: string[]): Promise<void> {
  try {
    const server = await main(argv);
    process.on('SIGINT', () => {
      void server.close().finally(() => process.exit(0));
    });
  } catch (err) {
    if (!(err instanceof LetterpressError)) throw err;
    console.error(err.message);
    process.exitCode = 1;
  }
}
