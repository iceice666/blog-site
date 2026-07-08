import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createOAuthStateCookie, pkceChallenge, randomBase64Url, safeReturnTo } from '../../../../lib/server/auth';
import { getRequiredEnv, jsonError } from '../../../../lib/server/http';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const requestUrl = new URL(request.url);
    const state = randomBase64Url();
    const verifier = randomBase64Url(48);
    const challenge = await pkceChallenge(verifier);
    const returnTo = safeReturnTo(requestUrl.searchParams.get('returnTo'));
    const redirectUri = new URL('/api/auth/github/callback', requestUrl.origin).toString();

    const githubUrl = new URL('https://github.com/login/oauth/authorize');
    githubUrl.searchParams.set('client_id', getRequiredEnv(env, 'GITHUB_CLIENT_ID'));
    githubUrl.searchParams.set('redirect_uri', redirectUri);
    githubUrl.searchParams.set('scope', 'public_repo');
    githubUrl.searchParams.set('state', state);
    githubUrl.searchParams.set('code_challenge', challenge);
    githubUrl.searchParams.set('code_challenge_method', 'S256');

    return new Response(null, {
      status: 302,
      headers: {
        location: githubUrl.toString(),
        'set-cookie': await createOAuthStateCookie(request, {
          state,
          verifier,
          returnTo,
          expiresAt: Date.now() + 10 * 60 * 1000,
        }),
      },
    });
  } catch (error) {
    return jsonError(error);
  }
};
