import { exampleSetup } from 'prosemirror-example-setup';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { splitPost, titleOf } from '../src/frontmatter.ts';
import { parseMarkdown, schema } from '../src/markdown.ts';

interface ClientConfig {
  bodyClass: string;
  lightClass: string;
}

function element<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

async function main(): Promise<void> {
  const status = element<HTMLSpanElement>('status');
  const title = element<HTMLHeadingElement>('title');
  const yamlField = element<HTMLTextAreaElement>('frontmatter');
  const config = (await (await fetch('/config')).json()) as ClientConfig;
  const text = await (await fetch('/post')).text();
  const post = splitPost(text);

  yamlField.value = post.frontmatter?.yaml ?? '';
  yamlField.hidden = post.frontmatter === null;
  title.textContent = titleOf(post.frontmatter) ?? '';

  const view = new EditorView(element<HTMLDivElement>('body'), {
    state: EditorState.create({
      doc: parseMarkdown(post.body),
      plugins: exampleSetup({ schema, menuBar: false, floatingMenu: false }),
    }),
    attributes: { class: config.bodyClass },
  });

  status.textContent = 'loaded';
  view.focus();
}

void main();
