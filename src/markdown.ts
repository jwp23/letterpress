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
  const trail = /(?:\r?\n)*$/.exec(body)![0];
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

/** Serializes a document back into the frame of the body it was parsed from. */
export function serializeBody(doc: Node, frame: BodyFrame): string {
  return frame.lead + serializer.serialize(doc) + frame.trail;
}
