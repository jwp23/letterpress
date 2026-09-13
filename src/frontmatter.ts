export interface Frontmatter {
  /** Raw text between the fences, including the last line's ending. */
  yaml: string;
  eol: '\n' | '\r\n';
}

export interface Post {
  frontmatter: Frontmatter | null;
  body: string;
}

const OPEN_FENCE = /^---(\r\n|\n)/;

/** Splits a post file into its verbatim frontmatter block and Markdown body. */
export function splitPost(text: string): Post {
  const open = OPEN_FENCE.exec(text);
  if (!open) return { frontmatter: null, body: text };
  const eol = open[1] as Frontmatter['eol'];
  const yamlStart = open[0].length;
  const closeFence = `${eol}---${eol}`;
  const close = text.indexOf(closeFence, yamlStart - eol.length);
  if (close === -1) return { frontmatter: null, body: text };
  const yamlEnd = close + eol.length;
  return {
    frontmatter: { yaml: text.slice(yamlStart, yamlEnd), eol },
    body: text.slice(close + closeFence.length),
  };
}

/** Reassembles a post file; splitPost then joinPost is byte-identical. */
export function joinPost(post: Post): string {
  if (!post.frontmatter) return post.body;
  const { yaml, eol } = post.frontmatter;
  return `---${eol}${yaml}---${eol}${post.body}`;
}
