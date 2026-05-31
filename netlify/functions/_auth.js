const crypto = require('crypto');

function getSecret() {
  return process.env.WT_SESSION_SECRET || '';
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

function createSession(username) {
  const payload = base64url(JSON.stringify({
    sub: username,
    exp: Date.now() + 1000 * 60 * 60 * 12,
  }));
  return payload + '.' + sign(payload);
}

function verifySession(token) {
  if (!token || !getSecret()) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parsed.exp && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

function authHeaders(event) {
  const header = event.headers.authorization || event.headers.Authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

module.exports = { createSession, verifySession, authHeaders };
