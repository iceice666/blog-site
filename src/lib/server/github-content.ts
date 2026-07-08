import { env } from 'cloudflare:workers';
import { githubHeaders } from './github-auth';
import { getRequiredEnv, HttpError } from './http';

export type ContentKind = 'post' | 'article';

export interface EditableFile {
  kind: ContentKind;
  path: string;
  name: string;
  slug: string;
  sha: string;
  size: number;
  url: string;
}

export interface LoadedFile extends EditableFile {
  content: string;
}

interface GitHubContentFile {
  type: 'file' | 'dir' | string;
  name: string;
  path: string;
  sha: string;
  size: number;
  html_url?: string;
  content?: string;
  encoding?: string;
}

interface GitHubError {
  message?: string;
}

interface PublishResult {
  content?: {
    path: string;
    sha: string;
    html_url?: string;
  };
  commit?: {
    sha: string;
    html_url?: string;
  };
}

export interface PublishInput {
  path: string;
  content: string;
  sha?: string | null;
  message?: string | null;
}

export interface DraftPayload {
  path: string;
  content: string;
  sha?: string | null;
  updatedAt: string;
}

export function parseContentPath(path: string | null | undefined) {
  const value = (path ?? '').trim();
  const match = value.match(/^content\/(posts|articles)\/(.+)$/u);
  if (!match) throw new HttpError(400, 'Invalid content path.', 'bad_content_path');

  const folder = match[1];
  const file = match[2];
  const kind: ContentKind = folder === 'posts' ? 'post' : 'article';
  const expectedExt = kind === 'post' ? '.md' : '.mdx';

  if (
    !file.endsWith(expectedExt) ||
    file.includes('/') ||
    file.includes('\\') ||
    file.startsWith('.') ||
    /[\u0000-\u001f]/u.test(file)
  ) {
    throw new HttpError(400, 'Invalid content filename.', 'bad_content_filename');
  }

  const slug = file.slice(0, -expectedExt.length);
  if (!slug) throw new HttpError(400, 'Content slug is required.', 'bad_content_slug');

  return { path: value, kind, slug, name: file };
}

export function contentPathForNew(kind: string | null | undefined, slug: string | null | undefined) {
  const normalizedKind = kind === 'article' ? 'article' : kind === 'post' ? 'post' : null;
  if (!normalizedKind) throw new HttpError(400, 'Invalid content kind.', 'bad_content_kind');

  const cleanSlug = (slug ?? '').trim();
  if (
    !cleanSlug ||
    cleanSlug.includes('/') ||
    cleanSlug.includes('\\') ||
    cleanSlug.startsWith('.') ||
    /\.[A-Za-z0-9]+$/u.test(cleanSlug) ||
    /[\u0000-\u001f]/u.test(cleanSlug)
  ) {
    throw new HttpError(400, 'Invalid slug.', 'bad_content_slug');
  }

  return normalizedKind === 'post'
    ? `content/posts/${cleanSlug}.md`
    : `content/articles/${cleanSlug}.mdx`;
}

export async function listEditableFiles() {
  const [posts, articles] = await Promise.all([
    listDirectory('content/posts', 'post', '.md'),
    listDirectory('content/articles', 'article', '.mdx'),
  ]);

  return [...articles, ...posts].sort((a, b) => a.path.localeCompare(b.path));
}

export async function loadContentFile(path: string) {
  const parsed = parseContentPath(path);
  const file = await githubJson<GitHubContentFile>(`/repos/${repoPath()}/contents/${encodePath(parsed.path)}?ref=${encodeURIComponent(branch())}`);

  if (file.type !== 'file' || file.encoding !== 'base64' || typeof file.content !== 'string') {
    throw new HttpError(502, 'GitHub returned an unreadable content file.', 'bad_github_content');
  }

  return {
    ...toEditableFile(file, parsed.kind),
    content: decodeBase64(file.content),
  };
}

export async function renderMarkdownPreview(content: string) {
  if (content.length > 200_000) {
    throw new HttpError(413, 'Preview content is too large.', 'preview_too_large');
  }

  const response = await fetch('https://api.github.com/markdown', {
    method: 'POST',
    headers: {
      ...githubHeaders(getRequiredEnv(env, 'GITHUB_TOKEN')),
      accept: 'text/html',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      text: stripMdxForPreview(content),
      mode: 'gfm',
      context: repoName(),
    }),
  });

  if (!response.ok) {
    const payload = await readGitHubError(response);
    throw new HttpError(response.status, payload.message || 'GitHub preview failed.', 'github_preview_failed');
  }

  return response.text();
}

export async function publishContentFile(input: PublishInput) {
  const parsed = parseContentPath(input.path);
  const existing = await getExistingSha(parsed.path);

  if (existing && input.sha !== existing) {
    throw new HttpError(409, 'This file changed on GitHub. Reload before publishing.', 'stale_content_sha');
  }
  if (!existing && input.sha) {
    throw new HttpError(409, 'This file does not exist on GitHub yet.', 'stale_content_sha');
  }

  const message = (input.message ?? '').trim() || `content: ${existing ? 'update' : 'create'} ${parsed.path}`;
  const result = await githubJson<PublishResult>(`/repos/${repoPath()}/contents/${encodePath(parsed.path)}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: encodeBase64(input.content),
      branch: branch(),
      ...(existing ? { sha: existing } : {}),
    }),
  });

  return {
    path: result.content?.path ?? parsed.path,
    sha: result.content?.sha ?? '',
    url: result.content?.html_url ?? result.commit?.html_url ?? '',
    commitSha: result.commit?.sha ?? '',
    commitUrl: result.commit?.html_url ?? '',
  };
}

export function draftKey(path: string) {
  return `admin:draft:${parseContentPath(path).path}`;
}

async function listDirectory(path: string, kind: ContentKind, ext: string) {
  const files = await githubJson<GitHubContentFile[]>(`/repos/${repoPath()}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch())}`);
  return files
    .filter((file) => file.type === 'file' && file.name.endsWith(ext))
    .map((file) => toEditableFile(file, kind));
}

async function getExistingSha(path: string) {
  const response = await fetch(githubApiUrl(`/repos/${repoPath()}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch())}`), {
    headers: githubHeaders(getRequiredEnv(env, 'GITHUB_TOKEN')),
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const payload = await readGitHubError(response);
    throw new HttpError(response.status, payload.message || 'Could not check existing file.', 'github_content_failed');
  }

  const file = (await response.json()) as GitHubContentFile;
  return file.sha;
}

async function githubJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(githubApiUrl(path), {
    ...init,
    headers: {
      ...githubHeaders(getRequiredEnv(env, 'GITHUB_TOKEN')),
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    const payload = await readGitHubError(response);
    throw new HttpError(response.status, payload.message || 'GitHub content request failed.', 'github_content_failed');
  }

  return response.json() as Promise<T>;
}

async function readGitHubError(response: Response): Promise<GitHubError> {
  return response.json().catch(() => ({})) as Promise<GitHubError>;
}

function toEditableFile(file: GitHubContentFile, kind: ContentKind): EditableFile {
  const parsed = parseContentPath(file.path);
  return {
    kind,
    path: file.path,
    name: file.name,
    slug: parsed.slug,
    sha: file.sha,
    size: file.size,
    url: file.html_url ?? '',
  };
}

function repoPath() {
  return encodePath(repoName());
}

function repoName() {
  const repo = getRequiredEnv(env, 'GITHUB_REPO').trim();
  if (!/^[^/\s]+\/[^/\s]+$/u.test(repo)) {
    throw new HttpError(500, 'GITHUB_REPO must be in owner/repo form.', 'bad_github_repo');
  }
  return repo;
}

function branch() {
  return getRequiredEnv(env, 'GITHUB_BRANCH');
}

function githubApiUrl(path: string) {
  return `https://api.github.com${path}`;
}

function encodePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function decodeBase64(value: string) {
  const clean = value.replace(/\s/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function stripMdxForPreview(content: string) {
  return content
    .replace(/^import .+$/gm, '')
    .replace(/^export .+$/gm, '')
    .replace(/<([A-Z][A-Za-z0-9.]*)\b[^>]*\/>/g, '`<$1 />`')
    .replace(/<([A-Z][A-Za-z0-9.]*)\b[^>]*>[\s\S]*?<\/\1>/g, '`<$1>...</$1>`');
}
