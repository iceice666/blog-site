import { getCollection, type CollectionEntry } from 'astro:content';

export const DEFAULT_ARTICLE_LANG = 'en';

export interface ArticleInfo {
  id: string;
  series: string | null;
  article: string;
  lang: string;
  translationKey: string;
  routeSlug: string;
  href: string;
  isStandalone: boolean;
}

export interface ArticleAlternate {
  lang: string;
  href: string;
  title: string;
  isCurrent: boolean;
}

export function getArticleInfo(id: string): ArticleInfo {
  const parts = id.split('/').filter(Boolean);
  const lang = parts.at(-1);
  const parents = parts.slice(0, -1);

  if (!lang || parents.length < 1 || parents.length > 2) {
    throw new Error(`Invalid article path "${id}". Use <article>/<lang>.mdx or <series>/<article>/<lang>.mdx.`);
  }

  for (const part of parts) assertArticlePathSegment(part, id);

  // Nesting depth decides the shape: <article>/<lang>.mdx is standalone,
  // <series>/<article>/<lang>.mdx belongs to a series.
  if (parents.length === 1) {
    const [article] = parents;
    return buildArticleInfo({ id, series: null, article, lang });
  }

  const [series, article] = parents;
  return buildArticleInfo({ id, series, article, lang });
}

export function isStandaloneArticleId(id: string) {
  return getArticleInfo(id).isStandalone;
}

export function isAboutArticleId(id: string) {
  const article = getArticleInfo(id);
  return article.isStandalone && article.article === 'about';
}

export function getArticleSlug(id: string) {
  return getArticleInfo(id).routeSlug;
}

export function getArticleHref(id: string) {
  return getArticleInfo(id).href;
}

export function getArticleCommentId(id: string) {
  const article = getArticleInfo(id);
  return `${article.translationKey.replaceAll('/', '__')}__${article.lang}`;
}

export async function getArticleAlternates(id: string): Promise<ArticleAlternate[]> {
  const current = getArticleInfo(id);
  const articles = await getCollection('articles');

  return articles
    .map((entry) => {
      const article = getArticleInfo(entry.id);
      if (article.translationKey !== current.translationKey) return null;
      return {
        lang: article.lang,
        href: article.href,
        title: entry.data.title,
        isCurrent: entry.id === id,
      };
    })
    .filter((item): item is ArticleAlternate => Boolean(item))
    .sort((a, b) => langSortKey(a.lang).localeCompare(langSortKey(b.lang)));
}

function buildArticleInfo(input: { id: string; series: string | null; article: string; lang: string }): ArticleInfo {
  const isStandalone = input.series === null;
  const translationKey = input.series ? `${input.series}/${input.article}` : input.article;
  const routeParts = isStandalone
    ? [input.lang === DEFAULT_ARTICLE_LANG ? input.article : `${input.article}-${input.lang}`]
    : input.lang === DEFAULT_ARTICLE_LANG
      ? [input.series!, input.article]
      : [input.series!, input.article, input.lang];
  const routeSlug = routeParts.join('/');
  const encodedRoute = routeParts.map(encodeURIComponent).join('/');
  const href = isStandalone ? `/${encodedRoute}` : `/articles/${encodedRoute}/`;

  return {
    id: input.id,
    series: input.series,
    article: input.article,
    lang: input.lang,
    translationKey,
    routeSlug,
    href,
    isStandalone,
  };
}

function assertArticlePathSegment(part: string, id: string) {
  if (!part || part.startsWith('.') || part.includes('\\') || /[\u0000-\u001f]/u.test(part)) {
    throw new Error(`Invalid article path segment in "${id}".`);
  }
}

function langSortKey(lang: string) {
  return lang === DEFAULT_ARTICLE_LANG ? `0:${lang}` : `1:${lang}`;
}

export function getPostSlug(id: string) {
  return id;
}

export function getPostHref(id: string) {
  return `/posts/${encodeURIComponent(getPostSlug(id))}/`;
}

/** Posts with no frontmatter date at all — mirrors the old build script's git-history fallback. */
const POST_FALLBACK_DATES: Record<string, string> = {
  '111': '2026-02-19',
  coffeecat: '2026-02-21',
};

const CJK_RE = /[一-鿿]/g;
const CJK_PRESENT_RE = /[一-鿿]/;
const LATIN_WORD_RE = /[A-Za-z0-9']+/g;

export function inferLang(id: string, explicit?: string, body = '') {
  if (explicit) return explicit;
  const pathLang = id.includes('/') ? id.split('/').at(-1) : null;
  if (pathLang) return pathLang;
  if (id.includes('.zh-tw')) return 'zh-tw';
  return CJK_PRESENT_RE.test(body) ? 'zh-tw' : 'en';
}

export function countUnits(text: string) {
  const cjk = text.match(CJK_RE)?.length ?? 0;
  const latin = text.match(LATIN_WORD_RE)?.length ?? 0;
  return cjk + latin;
}

export function readingTime(units: number) {
  return Math.max(1, Math.round(units / 200));
}

/** Rough plain-text extraction from raw MDX/markdown source, good enough for a word count. */
export function stripMarkdown(raw: string) {
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^import .+$/gm, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~[\]()|]/g, ' ');
}

/** A post that opens with its own `# Heading` renders that heading redundantly next to
 * the feed row's own title treatment — pull it out as the title instead. */
function extractLeadingH1(html: string): { title: string | null; rest: string } {
  const m = html.match(/^\s*<h1[^>]*>([\s\S]*?)<\/h1>\s*/);
  if (!m) return { title: null, rest: html };
  return { title: m[1].replace(/<[^>]+>/g, '').trim(), rest: html.slice(m[0].length) };
}

export interface FeedItem {
  kind: 'ARTICLE' | 'POST';
  id: string;
  href: string | null;
  title?: string;
  description: string;
  category: string;
  tags: string[];
  lang: string;
  publishedAt: string;
  units: number;
  readMin: number;
  /** Rendered body HTML — posts have no title, so their body IS the content. */
  bodyHtml?: string;
  /** True for a post that only links through to the article with the same id. */
  isStub?: boolean;
}

export function getPostArticleStubHref(post: CollectionEntry<'posts'>, articles: CollectionEntry<'articles'>[]) {
  const article = getPostArticleStubEntry(post, articles);
  return article ? getArticleHref(article.id) : null;
}

export async function getFeedItems(): Promise<FeedItem[]> {
  const articles = await getCollection('articles');
  const posts = await getCollection('posts');

  const articleItems: FeedItem[] = articles.map((entry) => {
    const article = getArticleInfo(entry.id);
    const lang = article.lang;
    const units = countUnits(stripMarkdown(entry.body ?? ''));
    return {
      kind: 'ARTICLE',
      id: entry.id,
      href: article.href,
      title: entry.data.title,
      description: entry.data.description,
      category: entry.data.category,
      tags: entry.data.tags,
      lang,
      publishedAt: entry.data.publishedAt ?? '',
      units,
      readMin: readingTime(units),
    };
  });

  const postItems: FeedItem[] = posts.map((entry) => {
    const stubArticle = getPostArticleStubEntry(entry, articles);
    const isStub = Boolean(stubArticle);
    const href = stubArticle ? getArticleHref(stubArticle.id) : getPostHref(entry.id);
    const units = countUnits(stripMarkdown(entry.body ?? ''));
    const { title: leadingTitle, rest: bodyHtml } = extractLeadingH1(entry.rendered?.html ?? '');
    return {
      kind: 'POST',
      id: entry.id,
      href,
      title: entry.data.title ?? leadingTitle ?? undefined,
      description: entry.data.description ?? '',
      category: entry.data.category ?? '',
      tags: entry.data.tags,
      lang: inferLang(entry.id, entry.data.lang, entry.body ?? ''),
      publishedAt: entry.data.publishedAt ?? POST_FALLBACK_DATES[entry.id] ?? '',
      units,
      readMin: readingTime(units),
      bodyHtml,
      isStub,
    };
  });

  return [...articleItems, ...postItems].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

function getPostArticleStubEntry(post: CollectionEntry<'posts'>, articles: CollectionEntry<'articles'>[]) {
  const explicitArticle = post.data.article?.trim();
  if (explicitArticle) {
    const article = findArticleByReference(explicitArticle, articles);
    if (!article) throw new Error(`Post "${post.id}" references unknown article "${explicitArticle}".`);
    return article;
  }

  return articles.find((article) => article.id === post.id) ?? null;
}

function findArticleByReference(ref: string, articles: CollectionEntry<'articles'>[]) {
  const normalized = normalizeArticleReference(ref);
  const direct = articles.find((entry) => entry.id === normalized);
  if (direct) return direct;

  const byTranslationKey = articles.filter((entry) => getArticleInfo(entry.id).translationKey === normalized);
  return byTranslationKey.find((entry) => getArticleInfo(entry.id).lang === DEFAULT_ARTICLE_LANG) ?? byTranslationKey[0] ?? null;
}

function normalizeArticleReference(ref: string) {
  return ref
    .trim()
    .replace(/^content\/articles\//, '')
    .replace(/^\/?articles\//, '')
    .replace(/\.mdx$/u, '')
    .replace(/\/$/u, '');
}

export interface BlogStats {
  entries: number;
  articles: number;
  words: number;
  langs: string[];
  topTags: string[];
}

export async function getBlogStats(): Promise<BlogStats> {
  const items = await getFeedItems();
  const articles = items.filter((i) => i.kind === 'ARTICLE');
  const words = articles.reduce((sum, i) => sum + i.units, 0);
  const langs = [...new Set(items.map((i) => i.lang))].sort();

  const tagFreq = new Map<string, number>();
  for (const item of items) {
    for (const tag of item.tags) tagFreq.set(tag, (tagFreq.get(tag) ?? 0) + 1);
  }
  const topTags = [...tagFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  return { entries: items.length, articles: articles.length, words, langs, topTags };
}

export const NAV_ITEMS = [
  { key: 'about', label: 'about', href: '/', windowIndex: 1 },
  { key: 'feed', label: 'feed', href: '/feed', windowIndex: 2 },
  { key: 'friends', label: 'friends', href: '/friends', windowIndex: 3 },
  { key: 'archive', label: 'archive', href: '/archive', windowIndex: 4 },
] as const;
