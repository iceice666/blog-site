export {};

type EntryType = 'article' | 'post';
import styles from '../styles/Comments.module.css';

const CLASS_MAP: Record<string, string> = {
  'comments-head': styles.commentsHead, 'comments-title': styles.title, 'comments-meta': styles.meta,
  'comments-controls': styles.commentsControls, 'comments-link': styles.link, 'comments-action': styles.action,
  'comments-user': styles.user, 'comment-list': styles.list, comment: styles.comment,
  'comment-meta': styles.commentMeta, 'comment-author': styles.author, 'comment-time': styles.time,
  'comment-delete': styles.delete, 'comment-body': styles.commentBody, 'comment-replies': styles.replies,
  'comment-form': styles.form, 'comment-reply-form': styles.replyForm, 'comment-form-actions': styles.formActions,
  'fold-note': styles.note, 'is-primary': styles.primary,
};

function moduleClasses(className?: string) {
  return className?.split(' ').map((name) => CLASS_MAP[name] ?? name).join(' ');
}

interface AuthUser {
  id: number;
  login: string;
  avatarUrl: string;
  profileUrl: string;
}

interface PublicReply {
  id: string;
  bodyHTML: string;
  bodyText: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  isMinimized: boolean;
  minimizedReason: string | null;
  author: {
    login: string;
    avatarUrl: string;
    url: string;
  } | null;
}

interface PublicComment extends PublicReply {
  replies: {
    totalCount: number;
    hasMore: boolean;
    nodes: PublicReply[];
  };
}

interface PublicDiscussion {
  id: string;
  number: number;
  url: string;
  totalCount: number;
  hasMore: boolean;
  comments: PublicComment[];
}

interface CommentsResponse {
  discussion: PublicDiscussion | null;
  user: AuthUser | null;
  error?: string;
}

interface WidgetEntry {
  entryType: EntryType;
  entryId: string;
  title: string;
  path: string;
}

interface WidgetState {
  entry: WidgetEntry;
  discussion: PublicDiscussion | null;
  user: AuthUser | null;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  replyTo: string | null;
  replySubmitting: boolean;
}

declare global {
  interface Window {
    __blogCommentsReady?: boolean;
  }
}

if (!window.__blogCommentsReady) {
  window.__blogCommentsReady = true;
  initComments();
}

function initComments() {
  const widgets = Array.from(document.querySelectorAll<HTMLElement>('[data-comments]'));
  widgets.forEach((widget) => {
    if (widget.dataset.commentsReady) return;
    widget.dataset.commentsReady = 'true';
    const state: WidgetState = {
      entry: readEntry(widget),
      discussion: null,
      user: null,
      loading: true,
      submitting: false,
      error: null,
      replyTo: null,
      replySubmitting: false,
    };
    render(widget, state);
    void load(widget, state);
  });
}

function readEntry(widget: HTMLElement): WidgetEntry {
  return {
    entryType: widget.dataset.entryType === 'post' ? 'post' : 'article',
    entryId: widget.dataset.entryId ?? '',
    title: widget.dataset.title ?? '',
    path: widget.dataset.path ?? location.pathname,
  };
}

async function load(widget: HTMLElement, state: WidgetState) {
  state.loading = true;
  state.error = null;
  render(widget, state);

  try {
    const params = new URLSearchParams({
      entryType: state.entry.entryType,
      entryId: state.entry.entryId,
      title: state.entry.title,
      path: state.entry.path,
    });
    const payload = await api<CommentsResponse>(`/api/comments?${params.toString()}`);
    state.discussion = payload.discussion;
    state.user = payload.user;
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Could not load comments.';
  } finally {
    state.loading = false;
    render(widget, state);
  }
}

function render(widget: HTMLElement, state: WidgetState) {
  const heading = widget.querySelector<HTMLHeadingElement>('[data-comments-title]');
  const headingId = heading?.id ?? '';
  widget.replaceChildren();
  widget.setAttribute('aria-labelledby', headingId);

  const head = el('div', 'comments-head');
  const titleBox = el('div');
  const title = el('h2', 'comments-title', 'comments');
  if (headingId) title.id = headingId;
  const meta = el(
    'p',
    'comments-meta',
    state.discussion ? `${state.discussion.totalCount} on GitHub Discussions` : 'GitHub Discussions',
  );
  appendNodes(titleBox, title, meta);

  const controls = el('div', 'comments-controls');
  renderControls(controls, widget, state);
  appendNodes(head, titleBox, controls);
  appendNodes(widget, head);

  if (state.error) appendNodes(widget, renderStatus(state.error, true));
  if (state.loading) appendNodes(widget, renderStatus('Loading comments...'));

  if (!state.loading) {
    renderList(widget, state);
    renderForm(widget, state);
  }
}

function renderControls(parent: HTMLElement, widget: HTMLElement, state: WidgetState) {
  if (state.discussion) {
    const discussion = el('a', 'comments-link', `#${state.discussion.number}`);
    discussion.href = state.discussion.url;
    discussion.target = '_blank';
    discussion.rel = 'noopener noreferrer';
    appendNodes(parent, discussion);
  }

  if (!state.user) {
    const login = el('a', 'comments-action', 'login');
    login.href = `/api/auth/github/start?returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`;
    appendNodes(parent, login);
    return;
  }

  const user = el('a', 'comments-user');
  user.href = state.user.profileUrl;
  user.target = '_blank';
  user.rel = 'noopener noreferrer';
  const avatar = document.createElement('img');
  avatar.src = state.user.avatarUrl;
  avatar.alt = '';
  avatar.loading = 'lazy';
  appendNodes(user, avatar, document.createTextNode(state.user.login));

  const logout = button('logout', 'comments-action');
  logout.addEventListener('click', async () => {
    logout.disabled = true;
    try {
      await api('/api/auth/logout', { method: 'POST' });
      await load(widget, state);
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Could not log out.';
      render(widget, state);
    }
  });

  appendNodes(parent, user, logout);
}

function renderList(widget: HTMLElement, state: WidgetState) {
  const comments = state.discussion?.comments ?? [];
  if (comments.length === 0) {
    appendNodes(widget, renderStatus('No comments yet.'));
    return;
  }

  const list = el('div', 'comment-list');
  for (const comment of comments) {
    appendNodes(list, renderComment(comment, widget, state));
  }
  appendNodes(widget, list);

  if (state.discussion?.hasMore) {
    const more = renderStatus('More comments are available on GitHub.');
    if (state.discussion.url) {
      const link = el('a', undefined, 'Open discussion');
      link.href = state.discussion.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      appendNodes(more, ' ', link);
    }
    appendNodes(widget, more);
  }
}

function renderComment(comment: PublicComment | PublicReply, widget: HTMLElement, state: WidgetState, isReply = false) {
  const item = el('article', isReply ? 'comment is-reply' : 'comment');
  const meta = el('div', 'comment-meta');

  if (comment.author) {
    const author = el('a', 'comment-author');
    author.href = comment.author.url;
    author.target = '_blank';
    author.rel = 'noopener noreferrer';
    const avatar = document.createElement('img');
    avatar.src = comment.author.avatarUrl;
    avatar.alt = '';
    avatar.loading = 'lazy';
    appendNodes(author, avatar, document.createTextNode(comment.author.login));
    appendNodes(meta, author);
  } else {
    appendNodes(meta, el('span', 'comment-author', 'ghost'));
  }

  const time = el('a', 'comment-time', formatTime(comment.createdAt));
  time.href = comment.url;
  time.target = '_blank';
  time.rel = 'noopener noreferrer';
  appendNodes(meta, time);

  if (!isReply && state.user) {
    const isOpen = state.replyTo === comment.id;
    const reply = button(isOpen ? 'cancel' : 'reply', 'comments-action');
    reply.addEventListener('click', () => {
      state.replyTo = isOpen ? null : comment.id;
      render(widget, state);
    });
    appendNodes(meta, reply);
  }

  if (state.user && comment.author?.login.toLowerCase() === state.user.login.toLowerCase()) {
    const remove = button('delete', 'comment-delete');
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try {
        const payload = await api<CommentsResponse>('/api/comments', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...state.entry, commentId: comment.id }),
        });
        state.discussion = payload.discussion;
        state.user = payload.user;
        state.error = null;
      } catch (error) {
        state.error = error instanceof Error ? error.message : 'Could not delete comment.';
      } finally {
        render(widget, state);
      }
    });
    appendNodes(meta, remove);
  }

  const body = el('div', 'comment-body');
  if (comment.isMinimized) {
    body.textContent = `Minimized: ${comment.minimizedReason ?? 'hidden'}`;
  } else {
    body.innerHTML = comment.bodyHTML;
  }

  appendNodes(item, meta, body);

  if (!isReply && 'replies' in comment && comment.replies.nodes.length > 0) {
    const replies = el('div', 'comment-replies');
    for (const reply of comment.replies.nodes) {
      appendNodes(replies, renderComment(reply, widget, state, true));
    }
    if (comment.replies.hasMore) {
      const more = renderStatus('More replies are available on GitHub.');
      appendNodes(replies, more);
    }
    appendNodes(item, replies);
  }

  if (!isReply && state.replyTo === comment.id) {
    appendNodes(item, renderReplyForm(comment.id, widget, state));
  }

  return item;
}

function renderReplyForm(parentId: string, widget: HTMLElement, state: WidgetState) {
  const form = document.createElement('form');
  form.className = moduleClasses('comment-form comment-reply-form') ?? '';

  const textarea = document.createElement('textarea');
  textarea.name = 'body';
  textarea.maxLength = 4000;
  textarea.required = true;
  textarea.placeholder = 'Write a reply...';
  textarea.autofocus = true;

  const actions = el('div', 'comment-form-actions');
  const cancel = button('cancel', 'comments-action');
  cancel.addEventListener('click', () => {
    state.replyTo = null;
    render(widget, state);
  });
  const submit = button(state.replySubmitting ? 'sending' : 'reply', 'comments-action');
  submit.type = 'submit';
  submit.disabled = state.replySubmitting;
  appendNodes(actions, cancel, submit);

  appendNodes(form, textarea, actions);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    state.replySubmitting = true;
    state.error = null;
    render(widget, state);

    try {
      const payload = await api<CommentsResponse>('/api/comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...state.entry, body: textarea.value, replyToId: parentId }),
      });
      state.discussion = payload.discussion;
      state.user = payload.user;
      state.replyTo = null;
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Could not post reply.';
    } finally {
      state.replySubmitting = false;
      render(widget, state);
    }
  });

  return form;
}

function renderForm(widget: HTMLElement, state: WidgetState) {
  if (!state.user) return;

  const form = document.createElement('form');
  form.className = moduleClasses('comment-form') ?? '';

  const textarea = document.createElement('textarea');
  textarea.name = 'body';
  textarea.maxLength = 4000;
  textarea.required = true;
  textarea.placeholder = 'Write a comment...';

  const actions = el('div', 'comment-form-actions');
  const submit = button(state.submitting ? 'sending' : 'send', 'comments-action');
  submit.type = 'submit';
  submit.disabled = state.submitting;
  appendNodes(actions, submit);

  appendNodes(form, textarea, actions);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    state.submitting = true;
    state.error = null;
    render(widget, state);

    try {
      const payload = await api<CommentsResponse>('/api/comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...state.entry, body: textarea.value }),
      });
      state.discussion = payload.discussion;
      state.user = payload.user;
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Could not post comment.';
    } finally {
      state.submitting = false;
      render(widget, state);
    }
  });

  appendNodes(widget, form);
}

function renderStatus(text: string, danger = false) {
  const node = el('p', `fold-note${danger ? ' is-danger' : ''}`, text);
  node.setAttribute('data-comments-status', '');
  return node;
}

async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error || `Request failed with ${response.status}`);
  return payload as T;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = moduleClasses(className) ?? '';
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text: string, className: string) {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = moduleClasses(className) ?? '';
  node.textContent = text;
  return node;
}

function appendNodes(parent: Node, ...children: Array<Node | string>) {
  for (const child of children) {
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}
