import { authToken, json, verifySession } from './_auth.js';

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';

export async function onRequestPost({ request, env }) {
  if (!await verifySession(authToken(request), env)) {
    return json({ error: 'Please log in again.' }, 401);
  }

  const apiKey = env.ANTHROPIC_API_KEY || '';
  if (!apiKey) {
    return json({ error: 'Anthropic API key is not configured in Cloudflare.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const endpoint = body.endpoint === 'models' ? '/models?limit=100' : '/messages';
  const method = body.endpoint === 'models' ? 'GET' : 'POST';
  const headers = {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  if (method === 'POST') headers['Content-Type'] = 'application/json';

  const resp = await fetch(ANTHROPIC_BASE + endpoint, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(body.payload || {}) : undefined,
  });

  return new Response(await resp.text(), {
    status: resp.status,
    headers: { 'Content-Type': resp.headers.get('Content-Type') || 'application/json' },
  });
}

export function onRequest() {
  return new Response('Method not allowed', { status: 405 });
}
