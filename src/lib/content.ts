import { getCollection } from 'astro:content';

/** MDX filename (sans extension) -> public route slug. */
export const ARTICLE_SLUGS: Record<string, string> = {
  'nhnc-2026-writeups': 'nhnc-2026-writeups',
  'about-me': 'about',
  'about-me.zh-tw': 'about-zh-tw',
};

export function isAboutArticleId(id: string) {
  return id === 'about-me' || id === 'about-me.zh-tw';
}

export function getArticleSlug(id: string) {
  return ARTICLE_SLUGS[id] ?? id;
}

export function getArticleHref(id: string) {
  const slug = getArticleSlug(id);
  return isAboutArticleId(id) ? `/${slug}` : `/articles/${slug}/`;
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
}

export async function getFeedItems(): Promise<FeedItem[]> {
  const articles = await getCollection('articles');
  const posts = await getCollection('posts');
  const articleIds = new Set(articles.map((a) => a.id));

  const articleItems: FeedItem[] = articles.map((entry) => {
    const lang = inferLang(entry.id, entry.data.lang, entry.body ?? '');
    const units = countUnits(stripMarkdown(entry.body ?? ''));
    return {
      kind: 'ARTICLE',
      id: entry.id,
      href: getArticleHref(entry.id),
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
    // A post stub sharing an id with a real article (e.g. the nhnc-2026-writeups
    // index stub) links through to that article instead of standing on its own.
    const href = articleIds.has(entry.id) ? getArticleHref(entry.id) : null;
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
    };
  });

  return [...articleItems, ...postItems].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
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
  { key: 'feed', label: 'feed', href: '/', windowIndex: 0 },
  { key: 'about', label: 'about', href: '/about', windowIndex: 1 },
  { key: 'friends', label: 'friends', href: '/friends', windowIndex: 2 },
  { key: 'archive', label: 'archive', href: '/archive', windowIndex: 3 },
] as const;
