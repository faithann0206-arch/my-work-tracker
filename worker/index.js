import { authToken, createSession, json, verifySession } from '../functions/api/_auth.js';

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';

async function handleAuth(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const configuredUser = (env.WT_USERNAME || '').trim();
  const configuredPassword = (env.WT_PASSWORD || '').trim();
  const configuredSecret = env.WT_SESSION_SECRET || '';

  if (!configuredUser || !configuredPassword || !configuredSecret) {
    return json({ error: 'Login is not configured. Set WT_USERNAME, WT_PASSWORD, and WT_SESSION_SECRET in Cloudflare.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const suppliedUser = String(body.username || '').trim();
  const suppliedPassword = String(body.password || '').trim();

  if (suppliedUser !== configuredUser || suppliedPassword !== configuredPassword) {
    return json({ error: 'Incorrect username or password.' }, 401);
  }

  return json({ token: await createSession(configuredUser, env) });
}

async function handleAnthropic(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/auth') {
      return handleAuth(request, env);
    }

    if (url.pathname === '/api/anthropic') {
      return handleAnthropic(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
