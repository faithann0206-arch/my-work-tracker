const { verifySession, authHeaders } = require('./_auth');

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  if (!verifySession(authHeaders(event))) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Please log in again.' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Anthropic API key is not configured in Netlify.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request.' }) };
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

  const text = await resp.text();
  return {
    statusCode: resp.status,
    headers: { 'Content-Type': resp.headers.get('Content-Type') || 'application/json' },
    body: text,
  };
};
