import { env } from 'cloudflare:workers';
import { getRequiredEnv, HttpError } from './http';
import type { AuthUser } from './auth';

const GITHUB_API_VERSION = '2022-11-28';
const USER_AGENT = 'justaslime-blog-comments';

interface GitHubTokenResponse {
  access_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface GitHubUserResponse {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
}

export async function exchangeCodeForToken({
  code,
  codeVerifier,
  redirectUri,
}: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}) {
  const body = new URLSearchParams({
    client_id: getRequiredEnv(env, 'GITHUB_CLIENT_ID'),
    client_secret: getRequiredEnv(env, 'GITHUB_CLIENT_SECRET'),
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': USER_AGENT,
    },
    body,
  });

  const payload = (await response.json()) as GitHubTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new HttpError(
      502,
      payload.error_description || payload.error || 'GitHub did not return an access token.',
      'github_oauth_failed',
    );
  }

  return {
    accessToken: payload.access_token,
    scope: payload.scope ?? '',
    tokenType: payload.token_type ?? 'bearer',
  };
}

export async function fetchGitHubUser(accessToken: string): Promise<AuthUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: githubHeaders(accessToken),
  });

  if (!response.ok) {
    throw new HttpError(502, 'Could not fetch GitHub user identity.', 'github_user_failed');
  }

  const user = (await response.json()) as GitHubUserResponse;
  return {
    id: user.id,
    login: user.login,
    avatarUrl: user.avatar_url,
    profileUrl: user.html_url,
  };
}

export function githubHeaders(token: string) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'user-agent': USER_AGENT,
    'x-github-api-version': GITHUB_API_VERSION,
  };
}
