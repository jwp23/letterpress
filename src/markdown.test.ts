import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { splitPost } from './frontmatter.ts';
import { bodyFrame, parseMarkdown, serializeBody } from './markdown.ts';

function roundTrip(body: string): string {
  return serializeBody(parseMarkdown(body), bodyFrame(body));
}

describe('markdown round-trip', () => {
  test('the fixture post comes back unchanged', () => {
    const { body } = splitPost(
      readFileSync(new URL('./fixtures/post.md', import.meta.url), 'utf8'),
    );
    expect(roundTrip(body)).toBe(body);
  });

  test.each(['', '\n\n', '\nOne line\n', '\r\nWindows\r\n'])(
    'preserves the frame of %j',
    (body) => {
      expect(roundTrip(body)).toBe(body);
    },
  );

  test('a body with no final newline gains one', () => {
    expect(roundTrip('No newline')).toBe('No newline\n');
  });

  test('bullet lists serialize with a dash', () => {
    expect(roundTrip('* star\n* list\n')).toBe('- star\n- list\n');
  });
});
