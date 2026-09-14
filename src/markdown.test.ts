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

  test('the lead keeps whitespace-only lines and stops at the first content line', () => {
    expect(bodyFrame(' \t\n\r\n  Text\n\n')).toEqual({ lead: ' \t\n\r\n', trail: '\n\n' });
  });

  test('the lead excludes leading spaces on the first content line', () => {
    expect(bodyFrame('\n    code\n').lead).toBe('\n');
  });

  test('the trail stays fast on a long run of newlines before content', () => {
    const body = `x${'\n'.repeat(100_000)}y`;
    const start = performance.now();
    expect(bodyFrame(body).trail).toBe('\n');
    expect(performance.now() - start).toBeLessThan(100);
  });

  test('a body with no final newline gains one', () => {
    expect(roundTrip('No newline')).toBe('No newline\n');
  });

  test('bullet lists serialize with a dash', () => {
    expect(roundTrip('* star\n* list\n')).toBe('- star\n- list\n');
  });
});
