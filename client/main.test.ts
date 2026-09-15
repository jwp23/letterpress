// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { joinPost } from '../src/frontmatter.ts';

interface ClientConfig {
  bodyClass: string;
  lightClass: string;
}

const CONFIG: ClientConfig = { bodyClass: 'prose', lightClass: 'light' };

let putCalls: { body: string }[];

function stubFetch(
  postText: string,
  opts: { putOk?: boolean; putErrorText?: string; putGate?: Promise<void> } = {},
): void {
  const { putOk = true, putErrorText = 'save failed', putGate = Promise.resolve() } = opts;
  putCalls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/config') {
        return Promise.resolve({ json: () => Promise.resolve(CONFIG) });
      }
      if (url === '/post' && init?.method === 'PUT') {
        const body = String(init.body);
        putCalls.push({ body });
        return putGate.then(() =>
          putOk ? { ok: true } : { ok: false, text: () => Promise.resolve(putErrorText) },
        );
      }
      if (url === '/post') {
        return Promise.resolve({ text: () => Promise.resolve(postText) });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );
}

/** jsdom does not implement matchMedia; only the exact light-scheme query reports a match. */
function stubMatchMedia(prefersLight: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: prefersLight && query === '(prefers-color-scheme: light)',
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
}

function setUpDom(): void {
  document.documentElement.className = '';
  document.body.innerHTML = `
    <span id="status">loading</span>
    <button id="theme" type="button">light / dark</button>
    <h1 id="title">Untitled</h1>
    <textarea id="frontmatter"></textarea>
    <div id="body"></div>
  `;
}

/** Loads a fresh instance of client/main.ts, running its top-level await to completion. */
async function loadMain(): Promise<void> {
  vi.resetModules();
  await import('./main.ts');
}

/** Replaces the frontmatter text the way typing into the textarea does. */
function editFrontmatter(value: string): void {
  const textarea = document.getElementById('frontmatter') as HTMLTextAreaElement;
  textarea.value = value;
  textarea.dispatchEvent(new Event('input'));
}

/** The ProseMirror editor element mounted inside #body. */
function editor(): HTMLElement {
  const dom = document.querySelector<HTMLElement>('#body .ProseMirror');
  if (!dom) throw new Error('editor not mounted');
  return dom;
}

/** Sends one keydown to the editor, as the browser would for a keypress with focus in it. */
function pressKey(init: KeyboardEventInit): void {
  editor().dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }),
  );
}

const EMPTY_RECT: DOMRect = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  toJSON: () => ({}),
};

beforeEach(() => {
  setUpDom();
  localStorage.clear();
  stubMatchMedia(false);
  // jsdom's Range has no layout; ProseMirror measures the selection through one after each edit.
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => EMPTY_RECT;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('initial render', () => {
  test('fills the title and frontmatter textarea from /post', async () => {
    stubFetch('---\ntitle: Hello\n---\nBody text.\n');
    await loadMain();
    expect(document.getElementById('title')?.textContent).toBe('Hello');
    const textarea = document.getElementById('frontmatter') as HTMLTextAreaElement;
    expect(textarea.value).toBe('title: Hello\n');
    expect(textarea.hidden).toBe(false);
    expect(document.getElementById('status')?.textContent).toBe('saved');
  });

  test('hides the frontmatter textarea when the post has none', async () => {
    stubFetch('Body text.\n');
    await loadMain();
    const textarea = document.getElementById('frontmatter') as HTMLTextAreaElement;
    expect(textarea.hidden).toBe(true);
    expect(textarea.value).toBe('');
  });

  test('falls back to Untitled when the post has no frontmatter', async () => {
    stubFetch('Body text.\n');
    await loadMain();
    expect(document.getElementById('title')?.textContent).toBe('Untitled');
  });

  test('falls back to Untitled when frontmatter has no title', async () => {
    stubFetch('---\nfoo: bar\n---\nBody text.\n');
    await loadMain();
    expect(document.getElementById('title')?.textContent).toBe('Untitled');
  });
});

describe('bootstrap', () => {
  test('fails loudly when a required element is missing', async () => {
    document.getElementById('status')?.remove();
    stubFetch('Body text.\n');
    await expect(loadMain()).rejects.toThrow('Missing element #status');
  });
});

describe('theme on load', () => {
  test('applies the stored light theme', async () => {
    localStorage.setItem('theme', 'light');
    stubFetch('Body text.\n');
    await loadMain();
    expect(document.documentElement.classList.contains(CONFIG.lightClass)).toBe(true);
  });

  test('keeps the stored dark theme over a light system preference', async () => {
    localStorage.setItem('theme', 'dark');
    stubMatchMedia(true);
    stubFetch('Body text.\n');
    await loadMain();
    expect(document.documentElement.classList.contains(CONFIG.lightClass)).toBe(false);
  });

  test('follows a light system preference when no theme is stored', async () => {
    stubMatchMedia(true);
    stubFetch('Body text.\n');
    await loadMain();
    expect(document.documentElement.classList.contains(CONFIG.lightClass)).toBe(true);
  });
});

describe('saving', () => {
  test('an edit to the frontmatter triggers a byte-exact PUT /post after the debounce', async () => {
    const original = '---\ntitle: Hello\n---\nBody text.\n';
    stubFetch(original);
    await loadMain();
    vi.useFakeTimers();

    const textarea = document.getElementById('frontmatter') as HTMLTextAreaElement;
    textarea.value = 'title: Changed\n';
    textarea.dispatchEvent(new Event('input'));
    expect(document.getElementById('status')?.textContent).toBe('editing');

    await vi.advanceTimersByTimeAsync(500);

    expect(putCalls).toHaveLength(1);
    expect(putCalls[0].body).toBe(
      joinPost({ frontmatter: { yaml: 'title: Changed\n', eol: '\n' }, body: 'Body text.\n' }),
    );
    expect(document.getElementById('title')?.textContent).toBe('Changed');
    expect(document.getElementById('status')?.textContent).toBe('saved');
  });

  test('a failed save shows the error in the status', async () => {
    stubFetch('Body text.\n', { putOk: false, putErrorText: 'disk full' });
    await loadMain();
    vi.useFakeTimers();

    const textarea = document.getElementById('frontmatter') as HTMLTextAreaElement;
    textarea.hidden = false;
    textarea.value = 'title: X\n';
    textarea.dispatchEvent(new Event('input'));

    await vi.advanceTimersByTimeAsync(500);

    expect(document.getElementById('status')?.textContent).toBe('error: disk full');
  });

  test('keeps CRLF frontmatter fences when saving', async () => {
    stubFetch('---\r\ntitle: Hello\r\n---\r\nBody text.\r\n');
    await loadMain();
    vi.useFakeTimers();

    editFrontmatter('title: Changed\n');
    await vi.advanceTimersByTimeAsync(500);

    expect(putCalls).toHaveLength(1);
    expect(putCalls[0].body).toBe('---\r\ntitle: Changed\n---\r\nBody text.\r\n');
  });

  test('adds LF frontmatter fences to a post that had none', async () => {
    stubFetch('Body text.\n');
    await loadMain();
    vi.useFakeTimers();

    const textarea = document.getElementById('frontmatter') as HTMLTextAreaElement;
    textarea.hidden = false;
    editFrontmatter('title: X\n');
    await vi.advanceTimersByTimeAsync(500);

    expect(putCalls).toHaveLength(1);
    expect(putCalls[0].body).toBe('---\ntitle: X\n---\nBody text.\n');
  });

  test('rapid edits collapse into one save', async () => {
    stubFetch('---\ntitle: Hello\n---\nBody text.\n');
    await loadMain();
    vi.useFakeTimers();

    editFrontmatter('title: First\n');
    await vi.advanceTimersByTimeAsync(200);
    editFrontmatter('title: Second\n');
    await vi.advanceTimersByTimeAsync(500);

    expect(putCalls).toHaveLength(1);
    expect(putCalls[0].body).toBe('---\ntitle: Second\n---\nBody text.\n');
  });

  test('shows saving while the PUT is in flight', async () => {
    let releasePut!: () => void;
    const putGate = new Promise<void>((resolve) => {
      releasePut = resolve;
    });
    stubFetch('---\ntitle: Hello\n---\nBody text.\n', { putGate });
    await loadMain();
    vi.useFakeTimers();

    editFrontmatter('title: Changed\n');
    await vi.advanceTimersByTimeAsync(500);
    expect(putCalls).toHaveLength(1);
    expect(document.getElementById('status')?.textContent).toBe('saving');

    releasePut();
    vi.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.getElementById('status')?.textContent).toBe('saved');
  });
});

describe('theme toggle', () => {
  test('toggles the light class and stores the theme', async () => {
    stubFetch('Body text.\n');
    await loadMain();
    const button = document.getElementById('theme') as HTMLButtonElement;

    button.click();
    expect(document.documentElement.classList.contains(CONFIG.lightClass)).toBe(true);
    expect(localStorage.getItem('theme')).toBe('light');

    button.click();
    expect(document.documentElement.classList.contains(CONFIG.lightClass)).toBe(false);
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});

describe('editor', () => {
  test('mounts with the body class, no menu bar, and focus', async () => {
    stubFetch('Body text.\n');
    await loadMain();
    expect(editor().classList.contains(CONFIG.bodyClass)).toBe(true);
    expect(document.querySelector('#body .ProseMirror-menubar')).toBeNull();
    expect(document.activeElement).toBe(editor());
  });

  test('an edit to the body saves the serialized document after the debounce', async () => {
    stubFetch('---\ntitle: Hello\n---\nBody text.\n');
    await loadMain();
    vi.useFakeTimers();

    pressKey({ key: 'Enter' });
    expect(document.getElementById('status')?.textContent).toBe('editing');

    await vi.advanceTimersByTimeAsync(500);

    expect(putCalls).toHaveLength(1);
    expect(putCalls[0].body).toBe('---\ntitle: Hello\n---\n\nBody text.\n');
    expect(document.getElementById('status')?.textContent).toBe('saved');
  });

  test('a selection change does not schedule a save', async () => {
    stubFetch('Body text.\n');
    await loadMain();
    vi.useFakeTimers();

    pressKey({ key: 'a', ctrlKey: true });
    expect(document.getSelection()?.isCollapsed).toBe(false);
    expect(document.getElementById('status')?.textContent).toBe('saved');

    await vi.advanceTimersByTimeAsync(500);
    expect(putCalls).toHaveLength(0);
  });
});
