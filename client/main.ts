import { exampleSetup } from 'prosemirror-example-setup';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { joinPost, splitPost, titleOf, type Frontmatter } from '../src/frontmatter.ts';
import { bodyFrame, parseMarkdown, schema, serializeBody } from '../src/markdown.ts';

const SAVE_DELAY_MS = 500;

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

  // Detect system color scheme preference and apply theme (matching site's Base.astro logic)
  try {
    const stored = localStorage.getItem('theme');
    const light =
      stored === 'light' ||
      (stored !== 'dark' && matchMedia('(prefers-color-scheme: light)').matches);
    if (light) document.documentElement.classList.add(config.lightClass);
  } catch (err) {
    // localStorage not available in some restricted environments
  }

  const text = await (await fetch('/post')).text();
  const post = splitPost(text);
  const frame = bodyFrame(post.body);
  const eol: Frontmatter['eol'] = post.frontmatter?.eol ?? '\n';

  yamlField.value = post.frontmatter?.yaml ?? '';
  yamlField.hidden = post.frontmatter === null;
  title.textContent = titleOf(post.frontmatter) ?? '';

  let timer: ReturnType<typeof setTimeout> | undefined;
  const scheduleSave = (): void => {
    status.textContent = 'editing';
    clearTimeout(timer);
    timer = setTimeout(() => void save(), SAVE_DELAY_MS);
  };

  const view = new EditorView(element<HTMLDivElement>('body'), {
    state: EditorState.create({
      doc: parseMarkdown(post.body),
      plugins: exampleSetup({ schema, menuBar: false, floatingMenu: false }),
    }),
    attributes: { class: config.bodyClass },
    dispatchTransaction(tr) {
      view.updateState(view.state.apply(tr));
      if (tr.docChanged) scheduleSave();
    },
  });

  async function save(): Promise<void> {
    status.textContent = 'saving';
    const frontmatter = yamlField.hidden ? null : { yaml: yamlField.value, eol };
    title.textContent = titleOf(frontmatter) ?? '';
    const body = joinPost({ frontmatter, body: serializeBody(view.state.doc, frame) });
    try {
      const res = await fetch('/post', { method: 'PUT', body });
      if (!res.ok) throw new Error(await res.text());
      status.textContent = 'saved';
    } catch (err) {
      status.textContent = `error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  yamlField.addEventListener('input', scheduleSave);
  element<HTMLButtonElement>('theme').addEventListener('click', () => {
    const light = document.documentElement.classList.toggle(config.lightClass);
    try {
      localStorage.setItem('theme', light ? 'light' : 'dark');
    } catch (err) {
      // localStorage not available in some restricted environments
    }
  });
  status.textContent = 'saved';
  view.focus();
}

void main();
