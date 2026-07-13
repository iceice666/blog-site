import { site } from '../../config';
import type { FeedItem } from './content';

interface RssMetadata {
  title?: string;
  description?: string;
}

function escapeXml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripTags(html?: string) {
  return (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function itemTitle(item: FeedItem) {
  if (item.title) return item.title;
  const text = stripTags(item.bodyHtml);
  return text.length > 70 ? `${text.slice(0, 70)}…` : text || '(no subject)';
}

function itemDescription(item: FeedItem) {
  return item.kind === 'ARTICLE' ? item.description : stripTags(item.bodyHtml);
}

export function createRssResponse(items: FeedItem[], metadata: RssMetadata = {}) {
  const entries = items
    .flatMap((item) => {
      if (!item.href) return [];
      const url = new URL(item.href, site.url).href;
      const pubDate = item.publishedAt
        ? `\n      <pubDate>${new Date(`${item.publishedAt}T00:00:00Z`).toUTCString()}</pubDate>`
        : '';
      return [`    <item>
      <title>${escapeXml(itemTitle(item))}</title>
      <link>${escapeXml(url)}</link>
      <guid>${escapeXml(url)}</guid>${pubDate}
      <description>${escapeXml(itemDescription(item))}</description>
    </item>`];
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(metadata.title ?? site.title)}</title>
    <link>${escapeXml(site.url)}</link>
    <description>${escapeXml(metadata.description ?? site.description)}</description>
${entries}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
