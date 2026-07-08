import { env } from 'cloudflare:workers';
import { requireSession } from './auth';
import { getRequiredEnv, HttpError } from './http';

export async function requireAdminSession(request: Request) {
  const session = await requireSession(request);
  const owner = getRequiredEnv(env, 'GITHUB_OWNER_ID').trim();
  const matchesId = owner === String(session.user.id);
  const matchesLogin = owner.toLowerCase() === session.user.login.toLowerCase();

  if (!matchesId && !matchesLogin) {
    throw new HttpError(403, 'This page is only available to the site owner.', 'admin_required');
  }

  return session;
}
