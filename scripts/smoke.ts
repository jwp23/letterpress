import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { findConfigFile, loadConfig } from '../src/config.ts';
import { startServer } from '../src/server.ts';

const postPath = path.resolve(process.argv[2] ?? '');
const configPath = findConfigFile(path.dirname(postPath));
if (!configPath) throw new Error(`No letterpress.json found above ${postPath}`);
const server = await startServer({
  config: loadConfig(configPath),
  postPath,
  pageDir: path.resolve('dist/client'),
});
const url = `http://127.0.0.1:${server.port}/`;
const { stdout } = await promisify(execFile)(
  'google-chrome-stable',
  ['--headless=new', '--disable-gpu', '--virtual-time-budget=3000', '--dump-dom', url],
  { maxBuffer: 1e7 },
);
console.log(stdout);
await server.close();
