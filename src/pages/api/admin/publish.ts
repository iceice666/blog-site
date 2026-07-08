import type { APIRoute } from 'astro';
import { requireAdminSession } from '../../../lib/server/admin-auth';
import { publishContentFile } from '../../../lib/server/github-content';
import { assertSameOrigin, json, jsonError, readJson } from '../../../lib/server/http';

export const prerender = false;

interface PublishRequest {
  path?: string;
  content?: string;
  sha?: string | null;
  message?: string | null;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    assertSameOrigin(request);
    const session = await requireAdminSession(request);
    const body = await readJson<PublishRequest>(request, 300_000);
    const result = await publishContentFile({
      path: body.path ?? '',
      content: body.content ?? '',
      sha: body.sha ?? null,
      message: body.message ?? null,
    });
    return json({ result, user: session.user });
  } catch (error) {
    return jsonError(error);
  }
};
