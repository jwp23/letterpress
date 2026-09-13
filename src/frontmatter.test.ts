import { describe, expect, test } from 'vitest';
import { joinPost, splitPost } from './frontmatter.ts';

const withFrontmatter = '---\ntitle: "Hello"\ndate: "2026-09-12"\n---\n\nBody text\n';

describe('splitPost', () => {
  test('separates the yaml block from the body', () => {
    expect(splitPost(withFrontmatter)).toEqual({
      frontmatter: { yaml: 'title: "Hello"\ndate: "2026-09-12"\n', eol: '\n' },
      body: '\nBody text\n',
    });
  });

  test('treats a file without fences as body only', () => {
    expect(splitPost('Just body\n')).toEqual({ frontmatter: null, body: 'Just body\n' });
  });

  test('handles an empty block', () => {
    expect(splitPost('---\n---\nBody\n')).toEqual({
      frontmatter: { yaml: '', eol: '\n' },
      body: 'Body\n',
    });
  });

  test('keeps CRLF line endings', () => {
    expect(splitPost('---\r\ntitle: x\r\n---\r\nBody\r\n')).toEqual({
      frontmatter: { yaml: 'title: x\r\n', eol: '\r\n' },
      body: 'Body\r\n',
    });
  });

  test('treats an unclosed fence as body only', () => {
    expect(splitPost('---\ntitle: x\n')).toEqual({ frontmatter: null, body: '---\ntitle: x\n' });
  });
});

describe('joinPost', () => {
  test.each([
    withFrontmatter,
    'Just body\n',
    '---\n---\nBody\n',
    '---\r\ntitle: x\r\n---\r\nBody\r\n',
    '',
  ])('round-trips %j byte for byte', (text) => {
    expect(joinPost(splitPost(text))).toBe(text);
  });
});
