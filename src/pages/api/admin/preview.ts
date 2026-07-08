import type { APIRoute } from 'astro';
import { requireAdminSession } from '../../../lib/server/admin-auth';
import { parseContentPath, renderMarkdownPreview } from '../../../lib/server/github-content';
import { assertSameOrigin, json, jsonError, readJson } from '../../../lib/server/http';

export const prerender = false;

interface PreviewRequest {
  path?: string;
  content?: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    assertSameOrigin(request);
    const session = await requireAdminSession(request);
    const body = await readJson<PreviewRequest>(request, 300_000);
    parseContentPath(body.path);
    const html = await renderMarkdownPreview(body.content ?? '');
    return json({ html, user: session.user });
  } catch (error) {
    return jsonError(error);
  }
};
