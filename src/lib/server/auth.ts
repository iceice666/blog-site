import { env } from 'cloudflare:workers';
import { getRequiredEnv, HttpError } from './http';

const SESSION_COOKIE = 'blog_github_session';
const OAUTH_COOKIE = 'blog_github_oauth';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const OAUTH_TTL_SECONDS = 60 * 10;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface AuthUser {
  id: number;
  login: string;
  avatarUrl: string;
  profileUrl: string;
}

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
  expiresAt: number;
}

export interface OAuthState {
  state: string;
  verifier: string;
  returnTo: string;
  expiresAt: number;
}

export function safeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const url = new URL(value, 'https://example.invalid');
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

export function getCookie(request: Request, name: string) {
  const cookies = request.headers.get('cookie') ?? '';
  for (const part of cookies.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName === name) return rawValue.join('=');
  }
  return null;
}

export function createClearSessionCookie(request: Request) {
  return serializeCookie(request, SESSION_COOKIE, '', { maxAge: 0 });
}

export function createClearOAuthCookie(request: Request) {
  return serializeCookie(request, OAUTH_COOKIE, '', { maxAge: 0 });
}

export async function createSessionCookie(request: Request, session: Omit<AuthSession, 'expiresAt'>) {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const value = await encryptJson<AuthSession>({ ...session, expiresAt });
  return serializeCookie(request, SESSION_COOKIE, value, { maxAge: SESSION_TTL_SECONDS });
}

export async function readSession(request: Request): Promise<AuthSession | null> {
  const raw = getCookie(request, SESSION_COOKIE);
  if (!raw) return null;

  try {
    const session = await decryptJson<AuthSession>(raw);
    if (!session.accessToken || !session.user?.login || session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function requireSession(request: Request) {
  const session = await readSession(request);
  if (!session) throw new HttpError(401, 'GitHub login is required.', 'login_required');
  return session;
}

export async function createOAuthStateCookie(request: Request, state: OAuthState) {
  const value = await encryptJson<OAuthState>(state);
  return serializeCookie(request, OAUTH_COOKIE, value, { maxAge: OAUTH_TTL_SECONDS });
}

export async function readOAuthState(request: Request): Promise<OAuthState | null> {
  const raw = getCookie(request, OAUTH_COOKIE);
  if (!raw) return null;

  try {
    const state = await decryptJson<OAuthState>(raw);
    if (!state.state || !state.verifier || state.expiresAt < Date.now()) return null;
    return state;
  } catch {
    return null;
  }
}

export function randomBase64Url(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function pkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(verifier));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function encryptJson<T>(value: T) {
  const key = await getAesKey();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const plaintext = encoder.encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(encrypted))}`;
}

async function decryptJson<T>(value: string): Promise<T> {
  const [version, rawIv, rawPayload] = value.split('.');
  if (version !== 'v1' || !rawIv || !rawPayload) throw new Error('Invalid encrypted payload.');

  const key = await getAesKey();
  const iv = base64UrlToBytes(rawIv);
  const payload = base64UrlToBytes(rawPayload);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, payload);
  return JSON.parse(decoder.decode(decrypted)) as T;
}

async function getAesKey() {
  const secret = getRequiredEnv(env, 'SESSION_SECRET');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function serializeCookie(
  request: Request,
  name: string,
  value: string,
  options: { maxAge: number },
) {
  const secure = new URL(request.url).protocol === 'https:';
  const parts = [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${options.maxAge}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
