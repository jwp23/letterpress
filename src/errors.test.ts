import { expect, test } from 'vitest';
import { LetterpressError } from './errors.ts';

test('LetterpressError carries its message and name', () => {
  const err = new LetterpressError('Post not found: /x.md');
  expect(err).toBeInstanceOf(Error);
  expect(err.message).toBe('Post not found: /x.md');
  expect(err.name).toBe('LetterpressError');
});
