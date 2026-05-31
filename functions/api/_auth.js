function getSecret(env) {
  return env.WT_SESSION_SECRET || '';
}

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
}

function encodePayload(value) {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function sign(payload, env) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret(env)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

export async function createSession(username, env) {
  const payload = encodePayload({
    sub: username,
    exp: Date.now() + 1000 * 60 * 60 * 12,
  });
  return payload + '.' + await sign(payload, env);
}

export async function verifySession(token, env) {
  if (!token || !getSecret(env)) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expected = await sign(payload, env);
  if (!timingSafeEqual(signature, expected)) return false;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    return Boolean(parsed.exp && parsed.exp > Date.now());
  } catch {
    return false;
  }
}

export function authToken(request) {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
