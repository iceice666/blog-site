import type { APIRoute } from 'astro';
import { requireAdminSession } from '../../../../lib/server/admin-auth';
import { loadContentFile } from '../../../../lib/server/github-content';
import { json, jsonError } from '../../../../lib/server/http';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const session = await requireAdminSession(request);
    const file = await loadContentFile(url.searchParams.get('path') ?? '');
    return json({ file, user: session.user });
  } catch (error) {
    return jsonError(error);
  }
};
