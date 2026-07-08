import type { APIRoute } from 'astro';
import { requireAdminSession } from '../../../lib/server/admin-auth';
import { listEditableFiles } from '../../../lib/server/github-content';
import { json, jsonError } from '../../../lib/server/http';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const session = await requireAdminSession(request);
    const files = await listEditableFiles();
    return json({ files, user: session.user });
  } catch (error) {
    return jsonError(error);
  }
};
