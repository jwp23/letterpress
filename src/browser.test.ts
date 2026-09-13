import { describe, expect, test } from 'vitest';
import { browserCommand } from './browser.ts';

describe('browserCommand', () => {
  test('uses app mode with the first available Chromium-family browser', () => {
    const available = new Set(['brave', 'chromium']);
    expect(browserCommand('http://x/', (c) => available.has(c))).toEqual({
      cmd: 'chromium',
      args: ['--app=http://x/'],
    });
  });

  test('falls back to xdg-open', () => {
    expect(browserCommand('http://x/', () => false)).toEqual({
      cmd: 'xdg-open',
      args: ['http://x/'],
    });
  });
});
