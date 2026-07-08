import type { APIRoute } from 'astro';
import { assertSameOrigin, json, jsonError } from '../../../lib/server/http';
import { createClearSessionCookie } from '../../../lib/server/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    assertSameOrigin(request);
    return json(
      { ok: true },
      {
        headers: {
          'set-cookie': createClearSessionCookie(request),
        },
      },
    );
  } catch (error) {
    return jsonError(error);
  }
};
