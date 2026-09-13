import type { Node } from 'prosemirror-model';
import {
  MarkdownSerializer,
  defaultMarkdownParser,
  defaultMarkdownSerializer,
  schema,
} from 'prosemirror-markdown';

export { schema };

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
  const lead = /^(?:[ \t]*\r?\n)*/.exec(body)![0];
  const trail = /(?:\r?\n)*$/.exec(body)![0];
  return { lead, trail: trail === '' ? '\n' : trail };
}

/** Serializes a document back into the frame of the body it was parsed from. */
export function serializeBody(doc: Node, frame: BodyFrame): string {
  return frame.lead + serializer.serialize(doc) + frame.trail;
}
