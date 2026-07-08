import type { APIRoute } from 'astro';
import { json, jsonError } from '../../../lib/server/http';
import { readSession } from '../../../lib/server/auth';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const session = await readSession(request);
    return json({ user: session?.user ?? null });
  } catch (error) {
    return jsonError(error);
  }
};
