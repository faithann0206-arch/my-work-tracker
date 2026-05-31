const { createSession } = require('./_auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const configuredUser = process.env.WT_USERNAME || '';
  const configuredPassword = process.env.WT_PASSWORD || '';
  const configuredSecret = process.env.WT_SESSION_SECRET || '';
  if (!configuredUser || !configuredPassword || !configuredSecret) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Login is not configured. Set WT_USERNAME, WT_PASSWORD, and WT_SESSION_SECRET in Netlify.' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request.' }) };
  }

  if (body.username !== configuredUser || body.password !== configuredPassword) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Incorrect username or password.' }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: createSession(configuredUser) }),
  };
};
