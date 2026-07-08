import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdminSession } from '../../../lib/server/admin-auth';
import { draftKey, parseContentPath, type DraftPayload } from '../../../lib/server/github-content';
import { assertSameOrigin, json, jsonError, readJson } from '../../../lib/server/http';

export const prerender = false;

interface DraftRequest {
  path?: string;
  content?: string;
  sha?: string | null;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const session = await requireAdminSession(request);
    const path = parseContentPath(url.searchParams.get('path')).path;
    const draft = await env.DRAFTS.get<DraftPayload>(draftKey(path), 'json');
    return json({ draft, user: session.user });
  } catch (error) {
    return jsonError(error);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    assertSameOrigin(request);
    const session = await requireAdminSession(request);
    const body = await readJson<DraftRequest>(request, 300_000);
    const path = parseContentPath(body.path).path;
    const content = body.content ?? '';

    if (content.length > 250_000) {
      return json({ error: 'Draft is too large.', code: 'draft_too_large' }, { status: 413 });
    }

    const draft: DraftPayload = {
      path,
      content,
      sha: body.sha ?? null,
      updatedAt: new Date().toISOString(),
    };
    await env.DRAFTS.put(draftKey(path), JSON.stringify(draft));
    return json({ draft, user: session.user });
  } catch (error) {
    return jsonError(error);
  }
};
