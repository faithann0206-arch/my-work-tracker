import { createSession, json } from './_auth.js';

export async function onRequestPost({ request, env }) {
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

export function onRequest() {
  return new Response('Method not allowed', { status: 405 });
}
