export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'request_error',
  ) {
    super(message);
  }
}

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function jsonError(error: unknown) {
  if (error instanceof HttpError) {
    return json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error(error);
  return json({ error: 'Unexpected server error.', code: 'server_error' }, { status: 500 });
}

export function getRequiredEnv(runtimeEnv: Cloudflare.Env, name: string) {
  const value = Reflect.get(runtimeEnv, name);
  if (typeof value !== 'string' || !value) {
    throw new HttpError(500, `Missing ${name} environment variable.`, 'missing_env');
  }
  return value;
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  if (origin !== new URL(request.url).origin) {
    throw new HttpError(403, 'Cross-origin requests are not allowed.', 'bad_origin');
  }
}

export async function readJson<T>(request: Request, maxBytes = 12_000): Promise<T> {
  const length = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(length) && length > maxBytes) {
    throw new HttpError(413, 'Request body is too large.', 'body_too_large');
  }

  const text = await request.text();
  if (text.length > maxBytes) {
    throw new HttpError(413, 'Request body is too large.', 'body_too_large');
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'Expected a JSON request body.', 'bad_json');
  }
}
