// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { joinPost } from '../src/frontmatter.ts';

interface ClientConfig {
  bodyClass: string;
  lightClass: string;
}

const CONFIG: ClientConfig = { bodyClass: 'prose', lightClass: 'light' };

let putCalls: { body: string }[];

function stubFetch(postText: string, opts: { putOk?: boolean; putErrorText?: string } = {}): void {
  const { putOk = true, putErrorText = 'save failed' } = opts;
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
        return putOk
          ? Promise.resolve({ ok: true })
          : Promise.resolve({ ok: false, text: () => Promise.resolve(putErrorText) });
      }
      if (url === '/post') {
        return Promise.resolve({ text: () => Promise.resolve(postText) });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }),
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

beforeEach(() => {
  setUpDom();
  localStorage.clear();
  // jsdom does not implement matchMedia; main.ts calls it while applying the theme.
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }),
  );
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
