import { spawn } from 'node:child_process';
import { accessSync, constants, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserCommand } from './browser.ts';
import { findConfigFile, loadConfig } from './config.ts';
import { LetterpressError } from './errors.ts';
import { startServer } from './server.ts';

function isOnPath(cmd: string): boolean {
  return (process.env.PATH ?? '').split(path.delimiter).some((dir) => {
    try {
      accessSync(path.join(dir, cmd), constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

async function main(argv: string[]): Promise<void> {
  const arg = argv[0];
  if (!arg) throw new LetterpressError('Usage: letterpress <post.md>');
  const postPath = path.resolve(arg);
  if (!existsSync(postPath)) throw new LetterpressError(`Post not found: ${postPath}`);
  const configPath = findConfigFile(path.dirname(postPath));
  if (!configPath) throw new LetterpressError(`No letterpress.json found above ${postPath}`);
  const config = loadConfig(configPath);
  const pageDir = fileURLToPath(new URL('../dist/client/', import.meta.url));
  if (!existsSync(path.join(pageDir, 'main.js'))) {
    throw new LetterpressError('Editor bundle is missing; run npm run build first');
  }
  const server = await startServer({ config, postPath, pageDir });
  const url = `http://127.0.0.1:${server.port}/`;
  const { cmd, args } = browserCommand(url, isOnPath);
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
  console.log(`Letterpress: ${postPath}\n${url}\nPress Ctrl+C to stop.`);
  process.on('SIGINT', () => {
    void server.close().finally(() => process.exit(0));
  });
}

main(process.argv.slice(2)).catch((err: unknown) => {
  if (err instanceof LetterpressError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
});
