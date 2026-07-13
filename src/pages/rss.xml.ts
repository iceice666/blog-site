import type { APIRoute } from 'astro';
import { getFeedItems } from '../lib/content';
import { createRssResponse } from '../lib/rss';

export const prerender = true;

export const GET: APIRoute = async () => {
  const items = (await getFeedItems()).filter((item) => !item.isStub && item.href);
  return createRssResponse(items);
};
