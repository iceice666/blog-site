export {};

type ContentKind = 'post' | 'article';

interface AuthUser {
  id: number;
  login: string;
  avatarUrl: string;
  profileUrl: string;
}

interface EditableFile {
  kind: ContentKind;
  path: string;
  name: string;
  slug: string;
  sha: string;
  size: number;
  url: string;
}

interface LoadedFile extends EditableFile {
  content: string;
}

interface DraftPayload {
  path: string;
  content: string;
  sha?: string | null;
  updatedAt: string;
}

interface EditorState {
  user: AuthUser | null;
  files: EditableFile[];
  current: LoadedFile | null;
  content: string;
  filter: string;
  previewHtml: string;
  status: string;
  error: string | null;
  loading: boolean;
  busy: boolean;
  createKind: ContentKind;
  createSlug: string;
}

interface ApiErrorPayload {
  error?: string;
  code?: string;
}

declare global {
  interface Window {
    __blogAdminEditorReady?: boolean;
  }
}

const root = document.querySelector<HTMLElement>('[data-admin-editor]');

if (root && !window.__blogAdminEditorReady) {
  window.__blogAdminEditorReady = true;
  const state: EditorState = {
    user: null,
    files: [],
    current: null,
    content: '',
    filter: '',
    previewHtml: '',
    status: 'Loading content...',
    error: null,
    loading: true,
    busy: false,
    createKind: 'post',
    createSlug: '',
  };
  render(root, state);
  void boot(root, state);
}

async function boot(root: HTMLElement, state: EditorState) {
  try {
    const payload = await api<{ files: EditableFile[]; user: AuthUser }>('/api/admin/content');
    state.files = payload.files;
    state.user = payload.user;
    state.loading = false;
    state.status = payload.files.length ? 'Select a file or create a new one.' : 'No editable files found.';
  } catch (error) {
    state.loading = false;
    state.error = messageFromError(error);
  } finally {
    render(root, state);
  }
}

function render(root: HTMLElement, state: EditorState) {
  root.replaceChildren();

  if (state.error === 'GitHub login is required.') {
    renderLoggedOut(root);
    return;
  }
  if (state.error && !state.user) {
    renderFatal(root, state.error);
    return;
  }

  const head = el('div', 'admin-editor-head');
  const titleBox = el('div');
  appendNodes(titleBox, el('h1', undefined, 'Editor'));
  appendNodes(titleBox, el('p', 'admin-editor-sub', state.user ? `signed in as ${state.user.login}` : 'private GitHub-backed content editor'));
  const actions = el('div', 'admin-editor-actions');
  if (state.user) {
    const profile = el('a', 'comments-user');
    profile.href = state.user.profileUrl;
    profile.target = '_blank';
    profile.rel = 'noopener noreferrer';
    const avatar = document.createElement('img');
    avatar.src = state.user.avatarUrl;
    avatar.alt = '';
    appendNodes(profile, avatar, document.createTextNode(state.user.login));
    appendNodes(actions, profile);
  }
  appendNodes(head, titleBox, actions);
  appendNodes(root, head);

  if (state.error) appendNodes(root, statusNode(state.error, true));
  appendNodes(root, statusNode(state.status));

  const shell = el('div', 'admin-editor-grid');
  appendNodes(shell, renderFilePane(root, state), renderEditPane(root, state), renderPreviewPane(root, state));
  appendNodes(root, shell);
}

function renderLoggedOut(root: HTMLElement) {
  const head = el('div', 'admin-editor-head');
  const box = el('div');
  appendNodes(box, el('h1', undefined, 'Editor'));
  appendNodes(box, el('p', 'admin-editor-sub', 'GitHub login is required.'));
  const login = el('a', 'comments-action', 'login with GitHub');
  login.href = `/api/auth/github/start?returnTo=${encodeURIComponent('/admin/edit')}`;
  appendNodes(head, box, login);
  appendNodes(root, head, statusNode('Sign in with the site owner GitHub account.', false));
}

function renderFatal(root: HTMLElement, error: string) {
  const head = el('div', 'admin-editor-head');
  appendNodes(head, el('h1', undefined, 'Editor'));
  appendNodes(root, head, statusNode(error, true));
}

function renderFilePane(root: HTMLElement, state: EditorState) {
  const pane = el('section', 'admin-panel admin-files');
  appendNodes(pane, panelTitle('files'));

  const filter = document.createElement('input');
  filter.className = 'admin-input';
  filter.type = 'search';
  filter.placeholder = 'filter files';
  filter.value = state.filter;
  filter.addEventListener('input', () => {
    state.filter = filter.value;
    render(root, state);
  });
  appendNodes(pane, filter);

  const create = el('div', 'admin-create');
  const kind = document.createElement('select');
  kind.className = 'admin-input';
  for (const value of ['post', 'article'] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    option.selected = state.createKind === value;
    kind.appendChild(option);
  }
  kind.addEventListener('change', () => {
    state.createKind = kind.value === 'article' ? 'article' : 'post';
    render(root, state);
  });

  const slug = document.createElement('input');
  slug.className = 'admin-input';
  slug.placeholder = 'new slug';
  slug.value = state.createSlug;
  slug.addEventListener('input', () => {
    state.createSlug = slug.value;
  });

  const createButton = button('new', 'comments-action');
  createButton.addEventListener('click', () => {
    const path = pathForNew(state.createKind, state.createSlug);
    if (!path) {
      state.error = 'Enter a slug without a file extension.';
      render(root, state);
      return;
    }
    const slugValue = state.createSlug.trim();
    state.current = {
      kind: state.createKind,
      path,
      name: path.split('/').at(-1) ?? path,
      slug: slugValue,
      sha: '',
      size: 0,
      url: '',
      content: templateFor(state.createKind, slugValue),
    };
    state.content = state.current.content;
    state.previewHtml = '';
    state.error = null;
    state.status = `New ${state.createKind}: ${path}`;
    render(root, state);
  });
  appendNodes(create, kind, slug, createButton);
  appendNodes(pane, create);

  const list = el('div', 'admin-file-list');
  const query = state.filter.trim().toLowerCase();
  for (const file of state.files.filter((item) => !query || item.path.toLowerCase().includes(query))) {
    const row = button(`${file.kind} ${file.slug}`, `admin-file${state.current?.path === file.path ? ' is-active' : ''}`);
    row.addEventListener('click', () => void loadFile(root, state, file.path));
    appendNodes(list, row);
  }
  appendNodes(pane, list);
  return pane;
}

function renderEditPane(root: HTMLElement, state: EditorState) {
  const pane = el('section', 'admin-panel admin-work');
  appendNodes(pane, panelTitle('source'));

  if (!state.current) {
    appendNodes(pane, el('p', 'fold-note', state.loading ? 'Loading...' : 'No file selected.'));
    return pane;
  }

  appendNodes(pane, el('p', 'admin-path', state.current.path));
  const meta = renderMetadata(root, state);
  appendNodes(pane, meta);

  const textarea = document.createElement('textarea');
  textarea.className = 'admin-source';
  textarea.spellcheck = false;
  textarea.value = state.content;
  textarea.addEventListener('input', () => {
    state.content = textarea.value;
    state.current!.content = textarea.value;
  });
  appendNodes(pane, textarea);

  const actions = el('div', 'admin-editor-actions');
  const save = button('save draft', 'comments-action');
  save.disabled = state.busy;
  save.addEventListener('click', () => void saveDraft(root, state));

  const preview = button('preview', 'comments-action');
  preview.disabled = state.busy;
  preview.addEventListener('click', () => void refreshPreview(root, state));

  const publish = button('publish', 'comments-action is-primary');
  publish.disabled = state.busy;
  publish.addEventListener('click', () => void publishFile(root, state));

  appendNodes(actions, save, preview, publish);
  appendNodes(pane, actions);
  return pane;
}

function renderMetadata(root: HTMLElement, state: EditorState) {
  const fields = el('div', 'admin-meta-grid');
  const article = state.current?.kind === 'article';
  const names = article
    ? ['title', 'description', 'category', 'tags', 'publishedAt', 'lang']
    : ['title', 'tags', 'publishedAt', 'lang'];

  for (const name of names) {
    const label = document.createElement('label');
    label.className = 'admin-field';
    appendNodes(label, el('span', undefined, name));
    const input = document.createElement('input');
    input.className = 'admin-input';
    input.value = frontmatterValue(state.content, name);
    input.addEventListener('change', () => {
      state.content = setFrontmatterValue(state.content, name, input.value, name === 'tags');
      if (state.current) state.current.content = state.content;
      render(root, state);
    });
    appendNodes(label, input);
    appendNodes(fields, label);
  }
  return fields;
}

function renderPreviewPane(root: HTMLElement, state: EditorState) {
  const pane = el('section', 'admin-panel admin-preview-panel');
  appendNodes(pane, panelTitle('preview'));

  if (!state.current) {
    appendNodes(pane, el('p', 'fold-note', 'Select or create a file.'));
    return pane;
  }

  const top = el('div', 'admin-preview-tools');
  const open = state.current.url ? el('a', 'comments-link', 'github') : null;
  if (open) {
    open.href = state.current.url;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    appendNodes(top, open);
  }
  const reload = button('reload', 'comments-action');
  reload.disabled = state.busy || !state.current.sha;
  reload.addEventListener('click', () => state.current && void loadFile(root, state, state.current.path, { ignoreDraft: true }));
  appendNodes(top, reload);
  appendNodes(pane, top);

  const preview = el('div', 'admin-preview prose');
  if (state.previewHtml) {
    preview.innerHTML = state.previewHtml;
  } else {
    preview.textContent = 'Press preview to render Markdown.';
  }
  appendNodes(pane, preview);
  return pane;
}

async function loadFile(root: HTMLElement, state: EditorState, path: string, options: { ignoreDraft?: boolean } = {}) {
  state.busy = true;
  state.error = null;
  state.status = `Loading ${path}...`;
  render(root, state);

  try {
    const payload = await api<{ file: LoadedFile; user: AuthUser }>(`/api/admin/content/file?path=${encodeURIComponent(path)}`);
    let content = payload.file.content;
    let status = `Loaded ${path}.`;

    if (!options.ignoreDraft) {
      const draftPayload = await api<{ draft: DraftPayload | null }>(`/api/admin/drafts?path=${encodeURIComponent(path)}`);
      if (draftPayload.draft) {
        content = draftPayload.draft.content;
        status = `Loaded draft from ${formatTime(draftPayload.draft.updatedAt)}.`;
      }
    }

    state.current = payload.file;
    state.content = content;
    state.previewHtml = '';
    state.user = payload.user;
    state.status = status;
  } catch (error) {
    state.error = messageFromError(error);
  } finally {
    state.busy = false;
    render(root, state);
  }
}

async function saveDraft(root: HTMLElement, state: EditorState) {
  if (!state.current) return;
  await runBusy(root, state, 'Saving draft...', async () => {
    const payload = await api<{ draft: DraftPayload }>('/api/admin/drafts', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: state.current!.path, content: state.content, sha: state.current!.sha || null }),
    });
    state.status = `Draft saved ${formatTime(payload.draft.updatedAt)}.`;
  });
}

async function refreshPreview(root: HTMLElement, state: EditorState) {
  if (!state.current) return;
  await runBusy(root, state, 'Rendering preview...', async () => {
    const payload = await api<{ html: string }>('/api/admin/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: state.current!.path, content: state.content }),
    });
    state.previewHtml = payload.html;
    state.status = 'Preview refreshed.';
  });
}

async function publishFile(root: HTMLElement, state: EditorState) {
  if (!state.current) return;
  await runBusy(root, state, 'Publishing to GitHub...', async () => {
    const payload = await api<{ result: { sha: string; commitUrl: string; url: string } }>('/api/admin/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: state.current!.path, content: state.content, sha: state.current!.sha || null }),
    });
    state.current!.sha = payload.result.sha;
    state.current!.url = payload.result.url || state.current!.url;
    const list = await api<{ files: EditableFile[]; user: AuthUser }>('/api/admin/content');
    state.files = list.files;
    state.user = list.user;
    state.status = payload.result.commitUrl ? `Published: ${payload.result.commitUrl}` : 'Published.';
  });
}

async function runBusy(root: HTMLElement, state: EditorState, status: string, fn: () => Promise<void>) {
  state.busy = true;
  state.error = null;
  state.status = status;
  render(root, state);
  try {
    await fn();
  } catch (error) {
    state.error = messageFromError(error);
  } finally {
    state.busy = false;
    render(root, state);
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => null)) as (ApiErrorPayload & T) | null;
  if (!response.ok) throw new Error(payload?.error || `Request failed with ${response.status}`);
  return payload as T;
}

function pathForNew(kind: ContentKind, slug: string) {
  const clean = slug.trim();
  if (!clean || clean.includes('/') || clean.includes('\\') || clean.startsWith('.') || /\.[A-Za-z0-9]+$/u.test(clean)) return null;
  return kind === 'post' ? `content/posts/${clean}.md` : `content/articles/${clean}.mdx`;
}

function templateFor(kind: ContentKind, slug: string) {
  const today = new Date().toISOString().slice(0, 10);
  if (kind === 'post') {
    return `---\ntitle: ${JSON.stringify(slug)}\npublishedAt: ${today}\ntags: []\n---\n\n`;
  }
  return `---\ntitle: ${JSON.stringify(slug)}\ndescription: ""\ncategory: ""\ntags: []\npublishedAt: ${today}\n---\n\n`;
}

function frontmatterValue(content: string, key: string) {
  const fm = readFrontmatter(content);
  const value = fm.values.get(key) ?? '';
  if (key === 'tags') return value.replace(/^\[/, '').replace(/\]$/, '');
  return value.replace(/^["']|["']$/g, '');
}

function setFrontmatterValue(content: string, key: string, value: string, isList = false) {
  const fm = readFrontmatter(content);
  const serialized = isList
    ? `[${value.split(',').map((item) => item.trim()).filter(Boolean).join(', ')}]`
    : value && /[:#\n]/u.test(value)
      ? JSON.stringify(value)
      : value;
  fm.values.set(key, serialized);
  const lines = [...fm.values.entries()].map(([name, val]) => `${name}: ${val}`);
  return `---\n${lines.join('\n')}\n---\n${fm.body}`;
}

function readFrontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/u);
  const values = new Map<string, string>();
  if (!match) return { values, body: `\n${content}` };

  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    if (key?.trim()) values.set(key.trim(), rest.join(':').trim());
  }
  return { values, body: match[2] };
}

function panelTitle(text: string) {
  const title = el('div', 'admin-panel-title', text);
  return title;
}

function statusNode(text: string, danger = false) {
  return el('p', `fold-note${danger ? ' is-danger' : ''}`, text);
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected editor error.';
}

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text: string, className: string) {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = className;
  node.textContent = text;
  return node;
}

function appendNodes(parent: Node, ...children: Array<Node | string | null>) {
  for (const child of children) {
    if (child === null) continue;
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}
