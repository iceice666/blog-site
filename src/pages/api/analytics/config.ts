import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getUmamiTrackerConfig } from '../../../lib/server/umami';
import { json, jsonError } from '../../../lib/server/http';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const umami = getUmamiTrackerConfig(env);
    if (!umami) {
      return json(
        { enabled: false },
        { headers: { 'cache-control': 'public, max-age=60' } },
      );
    }

    return json(
      { enabled: true, umami },
      { headers: { 'cache-control': 'public, max-age=300, s-maxage=300' } },
    );
  } catch (error) {
    return jsonError(error);
  }
};
