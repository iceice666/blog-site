import { HttpError } from './http';
import { site } from '../../../config';

interface UmamiConfig {
  apiUrl: string;
  hostUrl: string;
  websiteId: string;
  apiToken?: string;
  username?: string;
  password?: string;
}

interface UmamiTrackerConfig {
  hostUrl: string;
  websiteId: string;
  domains: string;
}

interface LoginResponse {
  token?: unknown;
}

interface ExpandedMetric {
  name?: unknown;
  pageviews?: unknown;
}

interface TokenCache {
  key: string;
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

export async function getUmamiPageviews(runtimeEnv: Cloudflare.Env, paths: string[]) {
  const config = readUmamiConfig(runtimeEnv);
  if (!config) return null;

  const metrics = await fetchExpandedPathMetrics(config);
  const counts = new Map<string, number>();
  for (const metric of metrics) {
    if (typeof metric.name !== 'string' || typeof metric.pageviews !== 'number') continue;
    counts.set(metric.name, metric.pageviews);
  }

  const result = new Map<string, number>();
  for (const path of paths) {
    let total = 0;
    for (const variant of pathVariants(path)) {
      total += counts.get(variant) ?? 0;
    }
    result.set(path, total);
  }

  return result;
}

export function getUmamiTrackerConfig(runtimeEnv: Cloudflare.Env): UmamiTrackerConfig | null {
  const apiUrl = normalizeApiUrl(optionalEnv(runtimeEnv, 'UMAMI_API_URL'));
  const websiteId = optionalEnv(runtimeEnv, 'UMAMI_WEBSITE_ID');
  const domains = optionalEnv(runtimeEnv, 'UMAMI_DOMAINS') ?? new URL(site.url).hostname;

  if (!apiUrl || !websiteId) return null;

  return {
    hostUrl: hostUrlFromApiUrl(apiUrl),
    websiteId: websiteId.trim(),
    domains: domains.trim(),
  };
}

function readUmamiConfig(runtimeEnv: Cloudflare.Env): UmamiConfig | null {
  const tracker = getUmamiTrackerConfig(runtimeEnv);
  const apiToken = optionalEnv(runtimeEnv, 'UMAMI_API_TOKEN');
  const username = optionalEnv(runtimeEnv, 'UMAMI_USERNAME');
  const password = optionalEnv(runtimeEnv, 'UMAMI_PASSWORD');

  if (!tracker) return null;
  if (!apiToken && (!username || !password)) return null;

  return {
    apiUrl: normalizeApiUrl(optionalEnv(runtimeEnv, 'UMAMI_API_URL'))!,
    hostUrl: tracker.hostUrl,
    websiteId: tracker.websiteId,
    apiToken,
    username,
    password,
  };
}

async function fetchExpandedPathMetrics(config: UmamiConfig) {
  const url = new URL(`${config.apiUrl}/websites/${encodeURIComponent(config.websiteId)}/metrics/expanded`);
  url.searchParams.set('startAt', '0');
  url.searchParams.set('endAt', String(Date.now()));
  url.searchParams.set('type', 'path');
  url.searchParams.set('limit', '1000');

  return fetchUmamiJson<ExpandedMetric[]>(config, url);
}

async function fetchUmamiJson<T>(config: UmamiConfig, url: URL, retry = true): Promise<T> {
  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
      authorization: await authHeader(config),
    },
  });

  if (res.status === 401 && retry && !config.apiToken) {
    tokenCache = null;
    return fetchUmamiJson(config, url, false);
  }

  if (!res.ok) {
    throw new HttpError(502, `Umami API request failed with ${res.status}.`, 'umami_api_error');
  }

  return res.json() as Promise<T>;
}

async function authHeader(config: UmamiConfig) {
  if (config.apiToken) return `Bearer ${config.apiToken}`;
  return `Bearer ${await login(config)}`;
}

async function login(config: UmamiConfig) {
  const key = `${config.apiUrl}:${config.username}`;
  if (tokenCache?.key === key && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  const res = await fetch(`${config.apiUrl}/auth/login`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      username: config.username,
      password: config.password,
    }),
  });

  if (!res.ok) {
    throw new HttpError(502, `Umami login failed with ${res.status}.`, 'umami_login_error');
  }

  const payload = (await res.json()) as LoginResponse;
  if (typeof payload.token !== 'string' || !payload.token) {
    throw new HttpError(502, 'Umami login response did not include a token.', 'umami_login_error');
  }

  tokenCache = {
    key,
    token: payload.token,
    expiresAt: Date.now() + 30 * 60 * 1000,
  };
  return payload.token;
}

function optionalEnv(runtimeEnv: Cloudflare.Env, name: string) {
  const value = Reflect.get(runtimeEnv, name);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeApiUrl(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return undefined;

  try {
    const url = new URL(trimmed);
    if (url.pathname === '/api' || url.pathname.endsWith('/api')) {
      return url.toString().replace(/\/+$/, '');
    }
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/api`;
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
}

function hostUrlFromApiUrl(apiUrl: string) {
  try {
    const url = new URL(apiUrl);
    url.pathname = url.pathname.replace(/\/api$/, '') || '/';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return apiUrl.replace(/\/api$/, '').replace(/\/+$/, '');
  }
}

function pathVariants(path: string) {
  const variants = new Set<string>();
  const raw = normalizePath(path);
  const decoded = decodePath(raw);
  const encoded = encodePath(decoded);

  addPathVariants(variants, raw);
  addPathVariants(variants, decoded);
  addPathVariants(variants, encoded);
  return variants;
}

function addPathVariants(variants: Set<string>, path: string) {
  variants.add(path);
  if (path !== '/' && path.endsWith('/')) {
    variants.add(path.slice(0, -1));
  } else if (path !== '/') {
    variants.add(`${path}/`);
  }
}

function normalizePath(value: string) {
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
    try {
      return new URL(value).pathname || '/';
    } catch {
      return '/';
    }
  }

  const path = value.startsWith('/') ? value : `/${value}`;
  return path.split('?')[0].split('#')[0] || '/';
}

function decodePath(path: string) {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

function encodePath(path: string) {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}
