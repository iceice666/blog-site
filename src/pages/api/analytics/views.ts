import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getUmamiPageviews } from '../../../lib/server/umami';
import { json, jsonError } from '../../../lib/server/http';

export const prerender = false;

const MAX_PATHS = 40;

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const paths = uniquePaths(url.searchParams.getAll('path')).slice(0, MAX_PATHS);

    const counts = paths.length > 0 ? await getUmamiPageviews(env, paths) : null;
    if (!counts) {
      return json(
        { enabled: false, views: {} },
        { headers: { 'cache-control': 'public, max-age=60' } },
      );
    }

    return json(
      {
        enabled: true,
        views: Object.fromEntries(paths.map((path) => [path, counts.get(path) ?? 0])),
      },
      { headers: { 'cache-control': 'public, max-age=60, s-maxage=300' } },
    );
  } catch (error) {
    return jsonError(error);
  }
};

function uniquePaths(paths: string[]) {
  const result = new Set<string>();
  for (const path of paths) {
    const clean = path.trim();
    if (!clean || clean.length > 500) continue;
    result.add(clean);
  }
  return [...result];
}
