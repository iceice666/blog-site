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

interface StatusLink {
  href: string;
  label: string;
}

interface EditorState {
  user: AuthUser | null;
  files: EditableFile[];
  current: LoadedFile | null;
  content: string;
  filter: string;
  previewHtml: string;
  status: string;
  statusDanger: boolean;
  statusLink: StatusLink | null;
  error: string | null;
  loading: boolean;
  busy: boolean;
  dirty: boolean;
  autoPreview: boolean;
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

const LOGIN_REQUIRED = 'GitHub login is required.';
const AUTOSAVE_DELAY = 2500;
const AUTOPREVIEW_DELAY = 1200;
const AUTOPREVIEW_KEY = 'blog:admin-autopreview';

// Live node references, rebuilt on every full render. Targeted updates
// (status line, dirty dot, counts, preview HTML, file list) go through these
// so typing in the source or filter never loses focus to a re-render.
const ui: {
  status: HTMLElement | null;
  dirty: HTMLElement | null;
  counts: HTMLElement | null;
  preview: HTMLElement | null;
  fileList: HTMLElement | null;
  textarea: HTMLTextAreaElement | null;
  saveButton: HTMLButtonElement | null;
  previewButton: HTMLButtonElement | null;
} = {
  status: null,
  dirty: null,
  counts: null,
  preview: null,
  fileList: null,
  textarea: null,
  saveButton: null,
  previewButton: null,
};

let autosaveTimer = 0;
let previewTimer = 0;
let previewSeq = 0;

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
    statusDanger: false,
    statusLink: null,
    error: null,
    loading: true,
    busy: false,
    dirty: false,
    autoPreview: readAutoPreview(),
    createKind: 'post',
    createSlug: '',
  };
  render(root, state);
  void boot(root, state);

  window.addEventListener('beforeunload', (event) => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  document.addEventListener('keydown', (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
    if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (state.current && !state.busy) void saveDraft(root, state);
    } else if (event.key === 'Enter') {
      if (!state.current || state.busy) return;
      event.preventDefault();
      void refreshPreview(root, state);
    }
  });
}

async function boot(root: HTMLElement, state: EditorState) {
  try {
    const payload = await api<{ files: EditableFile[]; user: AuthUser }>('/api/admin/content');
    state.files = payload.files;
    state.user = payload.user;
    state.loading = false;
    setStatusValues(state, payload.files.length ? 'Select a file or create a new one.' : 'No editable files found.');
  } catch (error) {
    state.loading = false;
    state.error = messageFromError(error);
  } finally {
    render(root, state);
  }
}

function render(root: HTMLElement, state: EditorState) {
  resetUi();
  root.replaceChildren();

  if (state.error === LOGIN_REQUIRED) {
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

  const status = el('p', 'admin-status');
  status.setAttribute('aria-live', 'polite');
  ui.status = status;
  paintStatus(state);
  appendNodes(root, status);

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
  appendNodes(pane, panelTitle(`files (${state.files.length})`));

  const filter = document.createElement('input');
  filter.className = 'admin-input';
  filter.type = 'search';
  filter.placeholder = 'filter files';
  filter.value = state.filter;
  filter.addEventListener('input', () => {
    state.filter = filter.value;
    paintFileList(root, state);
  });
  filter.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !filter.value) return;
    event.stopPropagation();
    filter.value = '';
    state.filter = '';
    paintFileList(root, state);
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
  });

  const slug = document.createElement('input');
  slug.className = 'admin-input';
  slug.placeholder = 'new slug';
  slug.value = state.createSlug;
  slug.addEventListener('input', () => {
    state.createSlug = slug.value;
  });
  slug.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    state.createSlug = slug.value;
    void createNewFile(root, state);
  });

  const createButton = button('new', 'comments-action');
  createButton.addEventListener('click', () => void createNewFile(root, state));
  appendNodes(create, kind, slug, createButton);
  appendNodes(pane, create);

  const list = el('div', 'admin-file-list');
  ui.fileList = list;
  paintFileList(root, state);
  appendNodes(pane, list);
  return pane;
}

function paintFileList(root: HTMLElement, state: EditorState) {
  const list = ui.fileList;
  if (!list) return;
  list.replaceChildren();

  const query = state.filter.trim().toLowerCase();
  const files = state.files.filter((item) => !query || item.path.toLowerCase().includes(query));
  if (!files.length) {
    appendNodes(list, el('p', 'admin-file-empty', state.loading ? 'Loading...' : query ? 'No matches.' : 'No editable files.'));
    return;
  }

  for (const file of files) {
    const row = button('', `admin-file${file.kind === 'article' ? ' is-article' : ''}${state.current?.path === file.path ? ' is-active' : ''}`);
    row.title = file.path;
    appendNodes(row, el('span', 'kind', file.kind), el('span', 'slug', file.slug));
    row.addEventListener('click', () => {
      if (state.current?.path === file.path) return;
      if (!confirmDiscard(state)) return;
      void loadFile(root, state, file.path);
    });
    appendNodes(list, row);
  }
}

function renderEditPane(root: HTMLElement, state: EditorState) {
  const pane = el('section', 'admin-panel admin-work');
  const title = panelTitle('source');
  const dirty = el('span', 'admin-dirty', '● unsaved');
  dirty.hidden = !state.dirty;
  ui.dirty = dirty;
  appendNodes(title, dirty);
  appendNodes(pane, title);

  if (!state.current) {
    appendNodes(pane, el('p', 'fold-note', state.loading ? 'Loading...' : 'Select a file on the left or create a new one.'));
    return pane;
  }

  appendNodes(pane, el('p', 'admin-path', state.current.path));
  appendNodes(pane, renderMetadata(root, state));

  const textarea = document.createElement('textarea');
  textarea.className = 'admin-source';
  textarea.spellcheck = false;
  textarea.value = state.content;
  textarea.addEventListener('input', () => handleEdit(root, state, textarea.value));
  textarea.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || event.shiftKey) return;
    event.preventDefault();
    if (!document.execCommand('insertText', false, '  ')) {
      textarea.setRangeText('  ', textarea.selectionStart ?? 0, textarea.selectionEnd ?? 0, 'end');
      handleEdit(root, state, textarea.value);
    }
  });
  ui.textarea = textarea;
  appendNodes(pane, textarea);

  const foot = el('div', 'admin-editor-foot');
  const counts = el('span', 'admin-counts');
  ui.counts = counts;
  updateCounts(state);

  const actions = el('div', 'admin-editor-actions');
  const save = button('save draft', 'comments-action');
  save.disabled = state.busy;
  save.title = 'ctrl/cmd+s';
  save.addEventListener('click', () => void saveDraft(root, state));
  ui.saveButton = save;

  const preview = button('preview', 'comments-action');
  preview.disabled = state.busy;
  preview.title = 'ctrl/cmd+enter';
  preview.addEventListener('click', () => void refreshPreview(root, state));
  ui.previewButton = preview;

  const publish = button('publish', 'comments-action is-primary');
  publish.disabled = state.busy;
  publish.title = 'commit to GitHub';
  publish.addEventListener('click', () => void publishFile(root, state));

  appendNodes(actions, save, preview, publish);
  appendNodes(foot, counts, actions);
  appendNodes(pane, foot);
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
      state.dirty = true;
      render(root, state);
      scheduleAutosave(root, state);
      schedulePreview(root, state);
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

  const auto = button(`auto: ${state.autoPreview ? 'on' : 'off'}`, `comments-action admin-toggle${state.autoPreview ? ' is-on' : ''}`);
  auto.setAttribute('aria-pressed', String(state.autoPreview));
  auto.title = 'render the preview automatically while typing';
  auto.addEventListener('click', () => {
    state.autoPreview = !state.autoPreview;
    persistAutoPreview(state.autoPreview);
    auto.textContent = `auto: ${state.autoPreview ? 'on' : 'off'}`;
    auto.classList.toggle('is-on', state.autoPreview);
    auto.setAttribute('aria-pressed', String(state.autoPreview));
    if (state.autoPreview) void refreshPreview(root, state, { auto: true });
    else paintPreview(state);
  });
  appendNodes(top, auto);

  if (state.current.url) {
    const open = el('a', 'comments-link', 'github');
    open.href = state.current.url;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    appendNodes(top, open);
  }

  const reload = button('reload', 'comments-action');
  reload.disabled = state.busy || !state.current.sha;
  reload.title = 'reload from GitHub, ignoring the saved draft';
  reload.addEventListener('click', () => {
    if (!state.current) return;
    if (state.dirty && !window.confirm('Discard unsaved changes and reload from GitHub?')) return;
    void loadFile(root, state, state.current.path, { ignoreDraft: true });
  });
  appendNodes(top, reload);
  appendNodes(pane, top);

  const preview = el('div', 'admin-preview prose');
  ui.preview = preview;
  paintPreview(state);
  appendNodes(pane, preview);
  return pane;
}

async function createNewFile(root: HTMLElement, state: EditorState) {
  const path = pathForNew(state.createKind, state.createSlug);
  if (!path) {
    setStatusValues(state, 'Enter a slug without a file extension.', { danger: true });
    return;
  }
  if (state.files.some((file) => file.path === path)) {
    setStatusValues(state, `${path} already exists — select it in the list.`, { danger: true });
    return;
  }
  if (!confirmDiscard(state)) return;

  clearTimers();
  const slugValue = state.createSlug.trim();
  let content = templateFor(state.createKind, slugValue);
  let status = `New ${state.createKind}: ${path}`;
  try {
    const draftPayload = await api<{ draft: DraftPayload | null }>(`/api/admin/drafts?path=${encodeURIComponent(path)}`);
    if (draftPayload.draft) {
      content = draftPayload.draft.content;
      status = `Restored draft of ${path} from ${formatTime(draftPayload.draft.updatedAt)}.`;
    }
  } catch {
    // Draft lookup is best-effort; fall back to the blank template.
  }

  state.current = {
    kind: state.createKind,
    path,
    name: path.split('/').at(-1) ?? path,
    slug: slugValue,
    sha: '',
    size: 0,
    url: '',
    content,
  };
  state.content = content;
  state.previewHtml = '';
  state.dirty = false;
  setStatusValues(state, status);
  render(root, state);
  ui.textarea?.focus();
  if (state.autoPreview) void refreshPreview(root, state, { auto: true });
}

async function loadFile(root: HTMLElement, state: EditorState, path: string, options: { ignoreDraft?: boolean } = {}) {
  clearTimers();
  await runBusy(root, state, `Loading ${path}...`, async () => {
    const payload = await api<{ file: LoadedFile; user: AuthUser }>(`/api/admin/content/file?path=${encodeURIComponent(path)}`);
    let content = payload.file.content;
    let status = `Loaded ${path}.`;

    if (!options.ignoreDraft) {
      const draftPayload = await api<{ draft: DraftPayload | null }>(`/api/admin/drafts?path=${encodeURIComponent(path)}`);
      if (draftPayload.draft && draftPayload.draft.content !== content) {
        content = draftPayload.draft.content;
        status = `Loaded draft from ${formatTime(draftPayload.draft.updatedAt)} — reload to discard it.`;
      }
    }

    state.current = payload.file;
    state.content = content;
    state.previewHtml = '';
    state.user = payload.user;
    state.dirty = false;
    setStatusValues(state, status);
  });
  if (state.autoPreview && state.current?.path === path) void refreshPreview(root, state, { auto: true });
}

async function saveDraft(root: HTMLElement, state: EditorState, options: { auto?: boolean } = {}) {
  if (!state.current || state.busy) return;
  const path = state.current.path;
  const snapshot = state.content;
  state.busy = true;
  if (ui.saveButton) ui.saveButton.disabled = true;
  if (!options.auto) setStatusValues(state, 'Saving draft...');
  try {
    const payload = await api<{ draft: DraftPayload }>('/api/admin/drafts', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path, content: snapshot, sha: state.current.sha || null }),
    });
    if (state.current?.path !== path) return;
    if (state.content === snapshot) {
      state.dirty = false;
      paintDirty(state);
    }
    setStatusValues(state, `Draft ${options.auto ? 'autosaved' : 'saved'} ${formatClock(payload.draft.updatedAt)}.`);
  } catch (error) {
    applyError(root, state, error);
  } finally {
    state.busy = false;
    if (ui.saveButton) ui.saveButton.disabled = false;
  }
}

async function refreshPreview(root: HTMLElement, state: EditorState, options: { auto?: boolean } = {}) {
  if (!state.current) return;
  const seq = ++previewSeq;
  if (!options.auto) {
    setStatusValues(state, 'Rendering preview...');
    if (ui.previewButton) ui.previewButton.disabled = true;
  }
  try {
    const payload = await api<{ html: string }>('/api/admin/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: state.current.path, content: state.content }),
    });
    if (seq !== previewSeq) return;
    state.previewHtml = payload.html;
    paintPreview(state);
    if (!options.auto) setStatusValues(state, 'Preview refreshed.');
  } catch (error) {
    if (seq === previewSeq) applyError(root, state, error);
  } finally {
    if (ui.previewButton) ui.previewButton.disabled = false;
  }
}

async function publishFile(root: HTMLElement, state: EditorState) {
  if (!state.current) return;
  const isNew = !state.current.sha;
  if (!window.confirm(`${isNew ? 'Create and publish' : 'Publish'} ${state.current.path} on GitHub?`)) return;
  clearTimers();
  await runBusy(root, state, 'Publishing to GitHub...', async () => {
    const payload = await api<{ result: { sha: string; commitUrl: string; url: string } }>('/api/admin/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: state.current!.path, content: state.content, sha: state.current!.sha || null }),
    });
    state.current!.sha = payload.result.sha;
    state.current!.url = payload.result.url || state.current!.url;
    state.dirty = false;
    const list = await api<{ files: EditableFile[]; user: AuthUser }>('/api/admin/content');
    state.files = list.files;
    state.user = list.user;
    setStatusValues(
      state,
      'Published.',
      payload.result.commitUrl ? { link: { href: payload.result.commitUrl, label: 'view commit' } } : undefined,
    );
  });
}

async function runBusy(root: HTMLElement, state: EditorState, status: string, fn: () => Promise<void>) {
  state.busy = true;
  setStatusValues(state, status);
  render(root, state);
  try {
    await fn();
  } catch (error) {
    applyError(root, state, error);
  } finally {
    state.busy = false;
    render(root, state);
  }
}

function handleEdit(root: HTMLElement, state: EditorState, value: string) {
  state.content = value;
  if (state.current) state.current.content = value;
  if (!state.dirty) {
    state.dirty = true;
    paintDirty(state);
  }
  updateCounts(state);
  scheduleAutosave(root, state);
  schedulePreview(root, state);
}

function scheduleAutosave(root: HTMLElement, state: EditorState) {
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    if (!state.dirty) return;
    if (state.busy) {
      scheduleAutosave(root, state);
      return;
    }
    void saveDraft(root, state, { auto: true });
  }, AUTOSAVE_DELAY);
}

function schedulePreview(root: HTMLElement, state: EditorState) {
  if (!state.autoPreview) return;
  window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => void refreshPreview(root, state, { auto: true }), AUTOPREVIEW_DELAY);
}

function clearTimers() {
  window.clearTimeout(autosaveTimer);
  window.clearTimeout(previewTimer);
}

function confirmDiscard(state: EditorState) {
  return !state.dirty || window.confirm('Discard unsaved changes?');
}

function applyError(root: HTMLElement, state: EditorState, error: unknown) {
  const message = messageFromError(error);
  if (message === LOGIN_REQUIRED) {
    state.error = message;
    render(root, state);
    return;
  }
  setStatusValues(state, message, { danger: true });
}

function setStatusValues(state: EditorState, text: string, options: { danger?: boolean; link?: StatusLink } = {}) {
  state.status = text;
  state.statusDanger = Boolean(options.danger);
  state.statusLink = options.link ?? null;
  paintStatus(state);
}

function paintStatus(state: EditorState) {
  const node = ui.status;
  if (!node) return;
  node.classList.toggle('is-danger', state.statusDanger);
  node.replaceChildren(document.createTextNode(state.status));
  if (state.statusLink) {
    const link = el('a', undefined, state.statusLink.label);
    link.href = state.statusLink.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    appendNodes(node, ' ', link);
  }
}

function paintDirty(state: EditorState) {
  if (ui.dirty) ui.dirty.hidden = !state.dirty;
}

function paintPreview(state: EditorState) {
  const node = ui.preview;
  if (!node) return;
  if (state.previewHtml) {
    node.innerHTML = state.previewHtml;
    return;
  }
  node.textContent = state.autoPreview
    ? 'Preview renders automatically after you edit.'
    : 'Press preview (or ctrl/cmd+enter) to render.';
}

function updateCounts(state: EditorState) {
  if (!ui.counts) return;
  const text = state.content;
  const lines = text ? text.split('\n').length : 0;
  const words = (text.match(/\S+/g) ?? []).length;
  ui.counts.textContent = `${lines} lines · ${words} words · ${text.length} chars`;
}

function resetUi() {
  ui.status = null;
  ui.dirty = null;
  ui.counts = null;
  ui.preview = null;
  ui.fileList = null;
  ui.textarea = null;
  ui.saveButton = null;
  ui.previewButton = null;
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

function readAutoPreview() {
  try {
    return window.localStorage.getItem(AUTOPREVIEW_KEY) !== 'off';
  } catch {
    return true;
  }
}

function persistAutoPreview(value: boolean) {
  try {
    window.localStorage.setItem(AUTOPREVIEW_KEY, value ? 'on' : 'off');
  } catch {
    // Local storage can be unavailable in private or embedded contexts.
  }
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

function formatClock(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }).format(new Date(value));
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
