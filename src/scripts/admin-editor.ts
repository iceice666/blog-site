export {};

type ContentKind = 'post' | 'article';
type CreateMode = 'post' | 'series' | 'article';

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
  view: 'home' | 'editor';
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
  createMode: CreateMode | null;
  create: { post: string; series: string; article: string; lang: string };
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
const PREVIEW_DELAY = 1200;

const CREATE_CARDS: Array<{ mode: CreateMode; title: string; hint: string }> = [
  { mode: 'post', title: 'New Post', hint: 'a short note — content/posts/<slug>.md' },
  { mode: 'series', title: 'New Series', hint: 'a series with its first article — content/articles/<series>/<article>/<lang>.mdx' },
  { mode: 'article', title: 'New Article', hint: 'a standalone article — content/articles/<article>/<lang>.mdx' },
];

// Live node references, rebuilt on every full render. Targeted updates
// (status line, dirty dot, counts, preview HTML, file list, create form)
// go through these so typing never loses focus to a re-render.
const ui: {
  status: HTMLElement | null;
  dirty: HTMLElement | null;
  counts: HTMLElement | null;
  preview: HTMLElement | null;
  fileList: HTMLElement | null;
  createForm: HTMLElement | null;
  textarea: HTMLTextAreaElement | null;
  saveButton: HTMLButtonElement | null;
  userSlot: HTMLElement | null;
} = {
  status: null,
  dirty: null,
  counts: null,
  preview: null,
  fileList: null,
  createForm: null,
  textarea: null,
  saveButton: null,
  userSlot: null,
};

let autosaveTimer = 0;
let previewTimer = 0;
let previewSeq = 0;

const root = document.querySelector<HTMLElement>('[data-admin-editor]');

if (root && !window.__blogAdminEditorReady) {
  window.__blogAdminEditorReady = true;
  ui.userSlot = document.querySelector<HTMLElement>('[data-editor-user]');
  const state: EditorState = {
    user: null,
    files: [],
    view: 'home',
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
    createMode: null,
    create: { post: '', series: '', article: '', lang: '' },
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
    if (state.view !== 'editor' || !state.current) return;
    if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (!state.busy) void saveDraft(root, state);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      window.clearTimeout(previewTimer);
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
    setStatusValues(state, payload.files.length ? 'Create something new or open an existing file.' : 'No editable files found — create one.');
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
  paintUser(state);

  if (state.error === LOGIN_REQUIRED) {
    renderLoggedOut(root);
    return;
  }
  if (state.error && !state.user) {
    renderFatal(root, state.error);
    return;
  }

  if (state.view === 'editor' && state.current) renderEditor(root, state);
  else renderHome(root, state);
}

function homeShell(root: HTMLElement) {
  const home = el('div', 'ed-home');
  const inner = el('div', 'ed-home-inner');
  appendNodes(home, inner);
  appendNodes(root, home);
  return inner;
}

function renderLoggedOut(root: HTMLElement) {
  const inner = homeShell(root);
  const box = el('div', 'ed-login');
  appendNodes(box, el('h1', undefined, 'Editor'));
  appendNodes(box, el('p', 'ed-sub', 'Sign in with the site owner GitHub account to edit content.'));
  const login = el('a', 'comments-action is-primary', 'login with GitHub');
  login.href = `/api/auth/github/start?returnTo=${encodeURIComponent('/admin/edit')}`;
  appendNodes(box, login);
  appendNodes(inner, box);
}

function renderFatal(root: HTMLElement, error: string) {
  const inner = homeShell(root);
  appendNodes(inner, el('h1', undefined, 'Editor'), statusNode(error, true));
}

function paintUser(state: EditorState) {
  const slot = ui.userSlot;
  if (!slot) return;
  slot.replaceChildren();
  if (!state.user) return;
  const profile = el('a', 'comments-user');
  profile.href = state.user.profileUrl;
  profile.target = '_blank';
  profile.rel = 'noopener noreferrer';
  const avatar = document.createElement('img');
  avatar.src = state.user.avatarUrl;
  avatar.alt = '';
  appendNodes(profile, avatar, document.createTextNode(state.user.login));
  appendNodes(slot, profile);
}

/* ---- home view ---- */

function renderHome(root: HTMLElement, state: EditorState) {
  const home = homeShell(root);

  appendNodes(home, el('h1', undefined, 'Editor'));
  appendNodes(home, el('p', 'ed-sub', 'Posts and articles live on GitHub. Drafts autosave while you type.'));

  const status = el('p', 'ed-status');
  status.setAttribute('aria-live', 'polite');
  ui.status = status;
  paintStatus(state);
  appendNodes(home, status);

  const grid = el('div', 'ed-new-grid');
  for (const card of CREATE_CARDS) {
    const btn = button('', `ed-new-card${state.createMode === card.mode ? ' is-active' : ''}`);
    btn.dataset.mode = card.mode;
    appendNodes(btn, el('strong', undefined, card.title), el('span', undefined, card.hint));
    btn.addEventListener('click', () => {
      state.createMode = state.createMode === card.mode ? null : card.mode;
      for (const other of grid.querySelectorAll<HTMLElement>('.ed-new-card')) {
        other.classList.toggle('is-active', other.dataset.mode === state.createMode);
      }
      paintCreateForm(root, state);
    });
    appendNodes(grid, btn);
  }
  appendNodes(home, grid);

  const form = el('div', 'ed-new-form');
  ui.createForm = form;
  paintCreateForm(root, state);
  appendNodes(home, form);

  const files = el('section', 'ed-files');
  const head = el('div', 'ed-files-head');
  appendNodes(head, el('h2', undefined, `Open existing (${state.files.length})`));
  const filter = document.createElement('input');
  filter.className = 'ed-input ed-filter';
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
  appendNodes(head, filter);
  appendNodes(files, head);

  const list = el('div', 'ed-file-list');
  ui.fileList = list;
  paintFileList(root, state);
  appendNodes(files, list);
  appendNodes(home, files);
}

function paintCreateForm(root: HTMLElement, state: EditorState) {
  const form = ui.createForm;
  if (!form) return;
  form.replaceChildren();
  const mode = state.createMode;
  form.hidden = !mode;
  if (!mode) return;

  const submit = () => void createNewFile(root, state);
  const fields = el('div', 'ed-new-fields');

  const addField = (label: string, key: 'post' | 'series' | 'article' | 'lang', placeholder: string) => {
    const wrap = document.createElement('label');
    wrap.className = 'ed-field';
    appendNodes(wrap, el('span', undefined, label));
    const input = document.createElement('input');
    input.className = 'ed-input';
    input.placeholder = placeholder;
    input.value = state.create[key];
    input.addEventListener('input', () => {
      state.create[key] = input.value;
    });
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      submit();
    });
    appendNodes(wrap, input);
    appendNodes(fields, wrap);
    return input;
  };

  let first: HTMLInputElement;
  if (mode === 'post') {
    first = addField('slug', 'post', 'my-new-post');
  } else if (mode === 'series') {
    first = addField('series', 'series', 'writeups');
    addField('article', 'article', 'ctf-2026');
    addField('lang', 'lang', 'en');
  } else {
    first = addField('article', 'article', 'my-article');
    addField('lang', 'lang', 'en');
  }
  appendNodes(form, fields);

  const actions = el('div', 'ed-new-actions');
  const create = button(`create ${mode}`, 'comments-action is-primary');
  create.addEventListener('click', submit);
  const cancel = button('cancel', 'comments-action');
  cancel.addEventListener('click', () => {
    state.createMode = null;
    for (const card of root.querySelectorAll<HTMLElement>('.ed-new-card')) card.classList.remove('is-active');
    paintCreateForm(root, state);
  });
  appendNodes(actions, create, cancel);
  appendNodes(form, actions);
  first.focus();
}

function paintFileList(root: HTMLElement, state: EditorState) {
  const list = ui.fileList;
  if (!list) return;
  list.replaceChildren();

  const query = state.filter.trim().toLowerCase();
  const files = state.files.filter((item) => !query || item.path.toLowerCase().includes(query));
  if (!files.length) {
    appendNodes(list, el('p', 'ed-file-empty', state.loading ? 'Loading...' : query ? 'No matches.' : 'No editable files.'));
    return;
  }

  for (const file of files) {
    const row = button('', `ed-file${file.kind === 'article' ? ' is-article' : ''}`);
    row.title = file.path;
    appendNodes(row, el('span', 'kind', file.kind), el('span', 'slug', file.slug));
    row.addEventListener('click', () => void loadFile(root, state, file.path));
    appendNodes(list, row);
  }
}

/* ---- editor view ---- */

function renderEditor(root: HTMLElement, state: EditorState) {
  const screen = el('div', 'ed-editor');

  const toolbar = el('div', 'ed-toolbar');

  const back = button('← files', 'comments-action');
  back.addEventListener('click', () => {
    if (!confirmDiscard(state)) return;
    closeEditor(root, state);
  });
  appendNodes(toolbar, back);

  const info = el('div', 'ed-toolbar-file');
  appendNodes(info, el('span', 'ed-path', state.current?.path ?? ''));
  const dirty = el('span', 'ed-dirty', '● unsaved');
  dirty.hidden = !state.dirty;
  ui.dirty = dirty;
  appendNodes(info, dirty);
  appendNodes(toolbar, info);

  const counts = el('span', 'ed-counts');
  ui.counts = counts;
  updateCounts(state);
  appendNodes(toolbar, counts);

  const actions = el('div', 'ed-toolbar-actions');
  if (state.current?.url) {
    const open = el('a', 'comments-link', 'github');
    open.href = state.current.url;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    appendNodes(actions, open);
  }
  if (state.current?.sha) {
    const reload = button('reload', 'comments-action');
    reload.disabled = state.busy;
    reload.title = 'reload from GitHub, ignoring the saved draft';
    reload.addEventListener('click', () => {
      if (!state.current) return;
      if (state.dirty && !window.confirm('Discard unsaved changes and reload from GitHub?')) return;
      void loadFile(root, state, state.current.path, { ignoreDraft: true });
    });
    appendNodes(actions, reload);
  }
  const save = button('save draft', 'comments-action');
  save.disabled = state.busy;
  save.title = 'ctrl/cmd+s';
  save.addEventListener('click', () => void saveDraft(root, state));
  ui.saveButton = save;
  const publish = button('publish', 'comments-action is-primary');
  publish.disabled = state.busy;
  publish.title = 'commit to GitHub';
  publish.addEventListener('click', () => void publishFile(root, state));
  appendNodes(actions, save, publish);
  appendNodes(toolbar, actions);
  appendNodes(screen, toolbar);

  const status = el('p', 'ed-status');
  status.setAttribute('aria-live', 'polite');
  ui.status = status;
  paintStatus(state);
  appendNodes(screen, status);

  const split = el('div', 'ed-split');

  const rawPane = el('section', 'ed-pane');
  appendNodes(rawPane, el('div', 'ed-pane-head', 'raw'));
  const textarea = document.createElement('textarea');
  textarea.className = 'ed-source';
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
  appendNodes(rawPane, textarea);

  const previewPane = el('section', 'ed-pane');
  appendNodes(previewPane, el('div', 'ed-pane-head', 'preview'));
  const preview = el('div', 'ed-preview prose');
  ui.preview = preview;
  paintPreview(state);
  appendNodes(previewPane, preview);

  appendNodes(split, rawPane, previewPane);
  appendNodes(screen, split);
  appendNodes(root, screen);
}

function closeEditor(root: HTMLElement, state: EditorState) {
  clearTimers();
  state.view = 'home';
  state.current = null;
  state.content = '';
  state.previewHtml = '';
  state.dirty = false;
  setStatusValues(state, 'Create something new or open an existing file.');
  render(root, state);
  void refreshFileList(root, state);
}

async function refreshFileList(root: HTMLElement, state: EditorState) {
  try {
    const payload = await api<{ files: EditableFile[]; user: AuthUser }>('/api/admin/content');
    state.files = payload.files;
    state.user = payload.user;
    if (state.view === 'home') render(root, state);
  } catch {
    // Keep the stale list; opening a file will surface real errors.
  }
}

async function createNewFile(root: HTMLElement, state: EditorState) {
  const target = createTarget(state);
  if (!target) {
    setStatusValues(state, 'Fill in every field (no slashes or file extensions).', { danger: true });
    return;
  }
  const path = pathForNew(target.kind, target.slug);
  if (!path) {
    setStatusValues(state, 'Invalid slug — avoid leading dots, slashes and file extensions.', { danger: true });
    return;
  }
  if (state.files.some((file) => file.path === path)) {
    setStatusValues(state, `${path} already exists — open it from the list below.`, { danger: true });
    return;
  }

  clearTimers();
  let content = templateFor(target.kind, target.slug);
  let status = `New ${state.createMode}: ${path}`;
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
    kind: target.kind,
    path,
    name: path.split('/').at(-1) ?? path,
    slug: target.slug,
    sha: '',
    size: 0,
    url: '',
    content,
  };
  state.content = content;
  state.previewHtml = '';
  state.dirty = false;
  state.view = 'editor';
  state.createMode = null;
  state.create = { post: '', series: '', article: '', lang: '' };
  setStatusValues(state, status);
  render(root, state);
  ui.textarea?.focus();
  void refreshPreview(root, state, { auto: true });
}

function createTarget(state: EditorState): { kind: ContentKind; slug: string } | null {
  const clean = (value: string) => value.trim().replace(/^\/+|\/+$/g, '');
  const post = clean(state.create.post);
  const series = clean(state.create.series);
  const article = clean(state.create.article);
  const lang = clean(state.create.lang) || 'en';
  const simple = (value: string) => Boolean(value) && !value.includes('/');

  switch (state.createMode) {
    case 'post':
      return simple(post) ? { kind: 'post', slug: post } : null;
    case 'series':
      return simple(series) && simple(article) && simple(lang)
        ? { kind: 'article', slug: `${series}/${article}/${lang}` }
        : null;
    case 'article':
      return simple(article) && simple(lang) ? { kind: 'article', slug: `${article}/${lang}` } : null;
    default:
      return null;
  }
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
    state.view = 'editor';
    setStatusValues(state, status);
  });
  if (state.current?.path === path) void refreshPreview(root, state, { auto: true });
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
  if (!options.auto) setStatusValues(state, 'Rendering preview...');
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
  window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => void refreshPreview(root, state, { auto: true }), PREVIEW_DELAY);
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
  node.textContent = 'Preview renders as you type.';
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
  ui.createForm = null;
  ui.textarea = null;
  ui.saveButton = null;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => null)) as (ApiErrorPayload & T) | null;
  if (!response.ok) throw new Error(payload?.error || `Request failed with ${response.status}`);
  return payload as T;
}

function pathForNew(kind: ContentKind, slug: string) {
  const clean = slug.trim();
  const segments = clean.split('/');
  if (!clean || segments.some((part) => !isSafePathSegment(part)) || /\.[A-Za-z0-9]+$/u.test(clean)) return null;
  if (kind === 'post' && segments.length !== 1) return null;
  if (kind === 'article' && segments.length !== 2 && segments.length !== 3) return null;
  return kind === 'post' ? `content/posts/${clean}.md` : `content/articles/${clean}.mdx`;
}

function templateFor(kind: ContentKind, slug: string) {
  const today = new Date().toISOString().slice(0, 10);
  const title = kind === 'article' ? (slug.split('/').at(-2) ?? slug) : slug;
  if (kind === 'post') {
    return `---\ntitle: ${JSON.stringify(title)}\npublishedAt: ${today}\ntags: []\n---\n\n`;
  }
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ""\ncategory: ""\ntags: []\npublishedAt: ${today}\n---\n\n`;
}

function isSafePathSegment(segment: string) {
  return Boolean(segment) && !segment.startsWith('.') && !segment.includes('\\') && !/[\u0000-\u001f]/u.test(segment);
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
