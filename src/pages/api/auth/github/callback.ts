import type { APIRoute } from 'astro';
import {
  createClearOAuthCookie,
  createSessionCookie,
  readOAuthState,
} from '../../../../lib/server/auth';
import { exchangeCodeForToken, fetchGitHubUser } from '../../../../lib/server/github-auth';
import { HttpError, jsonError } from '../../../../lib/server/http';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const state = requestUrl.searchParams.get('state');
    const oauthState = await readOAuthState(request);

    if (requestUrl.searchParams.has('error')) {
      throw new HttpError(400, requestUrl.searchParams.get('error_description') || 'GitHub login was cancelled.', 'oauth_denied');
    }
    if (!code || !state || !oauthState || oauthState.state !== state) {
      throw new HttpError(400, 'GitHub login state did not match.', 'bad_oauth_state');
    }

    const redirectUri = new URL('/api/auth/github/callback', requestUrl.origin).toString();
    const token = await exchangeCodeForToken({
      code,
      codeVerifier: oauthState.verifier,
      redirectUri,
    });
    const user = await fetchGitHubUser(token.accessToken);

    const headers = new Headers({
      location: oauthState.returnTo,
    });
    headers.append('set-cookie', await createSessionCookie(request, { accessToken: token.accessToken, user }));
    headers.append('set-cookie', createClearOAuthCookie(request));

    return new Response(null, { status: 302, headers });
  } catch (error) {
    return jsonError(error);
  }
};
