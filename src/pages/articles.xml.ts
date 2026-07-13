import type { APIRoute } from 'astro';
import { site } from '../../config';
import { getFeedItems } from '../lib/content';
import { createRssResponse } from '../lib/rss';

export const prerender = true;

export const GET: APIRoute = async () => {
  const items = (await getFeedItems()).filter(
    (item) => item.kind === 'ARTICLE' && item.href,
  );

  return createRssResponse(items, {
    title: `${site.title} — Articles`,
    description: `${site.description} — long-form articles only`,
  });
};
