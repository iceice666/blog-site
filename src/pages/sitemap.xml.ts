import type { APIRoute } from 'astro';
import { getFeedItems } from '../lib/content';
import { site } from '../../config';

export const prerender = true;

export const GET: APIRoute = async () => {
  const items = await getFeedItems();

  const lastmodByPath = new Map<string, string>();
  for (const item of items) {
    if (!item.href || !item.publishedAt) continue;
    const existing = lastmodByPath.get(item.href);
    if (!existing || item.publishedAt > existing) lastmodByPath.set(item.href, item.publishedAt);
  }

  const paths = [...new Set(['/', '/feed', '/archive', '/friends', ...items.flatMap((item) => (item.href ? [item.href] : []))])];

  const entries = paths
    .map((path) => {
      const lastmod = lastmodByPath.get(path);
      return `  <url>
    <loc>${new URL(path, site.url).href}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
