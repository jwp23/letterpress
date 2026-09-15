import type { Node } from 'prosemirror-model';
import {
  MarkdownSerializer,
  defaultMarkdownParser,
  defaultMarkdownSerializer,
} from 'prosemirror-markdown';

export { schema } from 'prosemirror-markdown';

/** The default serializer with bullet lists written as `- item`. */
export const serializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    bullet_list(state, node) {
      state.renderList(node, '  ', () => (node.attrs.bullet || '-') + ' ');
    },
  },
  defaultMarkdownSerializer.marks,
  defaultMarkdownSerializer.options,
);

export function parseMarkdown(markdown: string): Node {
  return defaultMarkdownParser.parse(markdown);
}

/** Blank lines around a body that the serializer would drop. */
export interface BodyFrame {
  lead: string;
  trail: string;
}

export function bodyFrame(body: string): BodyFrame {
  if (body.trim() === '') return { lead: body, trail: '' };
  const lead = body.slice(0, leadingBlankLinesEnd(body));
  const trail = body.slice(trailingLineEndingsStart(body));
  return { lead, trail: trail === '' ? '\n' : trail };
}

/** Index just past the whitespace-only lines that open the body. */
function leadingBlankLinesEnd(body: string): number {
  let end = 0;
  for (let nl = body.indexOf('\n'); nl !== -1; nl = body.indexOf('\n', end)) {
    if (!/^[ \t]*\r?$/.test(body.slice(end, nl))) break;
    end = nl + 1;
  }
  return end;
}

/** Index where the run of line endings that closes the body begins. */
function trailingLineEndingsStart(body: string): number {
  let start = body.length;
  // Stryker disable next-line ConditionalExpression,EqualityOperator: at start === 0, body[-1] is undefined, so the guard is redundant; equivalent
  while (start > 0 && body[start - 1] === '\n') {
    start -= body[start - 2] === '\r' ? 2 : 1;
  }
  return start;
}

/** Serializes a document back into the frame of the body it was parsed from. */
export function serializeBody(doc: Node, frame: BodyFrame): string {
  return frame.lead + serializer.serialize(doc) + frame.trail;
}
