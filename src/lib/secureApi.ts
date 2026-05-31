export const AUTH_TOKEN_KEY = 'hr_auth_token';

const API_BASES = ['/api', '/.netlify/functions'];

function getToken(): string {
  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

async function apiFetch(path: string, init: RequestInit): Promise<Response> {
  let lastResponse: Response | null = null;
  for (const base of API_BASES) {
    const resp = await fetch(base + path, init);
    if (resp.status !== 404) return resp;
    lastResponse = resp;
  }
  return lastResponse || fetch(API_BASES[0] + path, init);
}

export async function login(username: string, password: string): Promise<string> {
  const resp = await apiFetch('/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.error || 'Login failed.');
  }
  if (!data.token) throw new Error('Login did not return a session token.');
  return data.token as string;
}

async function secureAnthropic(endpoint: 'models' | 'messages', payload?: unknown): Promise<Response> {
  return apiFetch('/anthropic', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + getToken(),
    },
    body: JSON.stringify({ endpoint, payload }),
  });
}

export async function anthropicModels(): Promise<string[]> {
  const resp = await secureAnthropic('models');
  if (!resp.ok) return [];
  const data = await resp.json() as { data?: Array<{ id?: string }> };
  return (data.data || []).map(model => model.id).filter((id): id is string => Boolean(id));
}

export async function anthropicMessage(payload: Record<string, unknown>): Promise<{ content: Array<{ type?: string; text?: string }> }> {
  const resp = await secureAnthropic('messages', payload);
  const text = await resp.text();
  if (!resp.ok) {
    if (resp.status === 401) throw new Error('LOGIN_REQUIRED');
    if (resp.status === 429) throw new Error('RATE_LIMITED');
    if (resp.status === 404 || text.includes('not_found_error') || text.includes('model:')) {
      throw new Error('MODEL_NOT_AVAILABLE');
    }
    if (text.includes('web_search') || text.includes('tool')) {
      throw new Error('WEB_SEARCH_NOT_AVAILABLE');
    }
    throw new Error('API_ERROR_' + resp.status + (text ? ': ' + text.slice(0, 200) : ''));
  }
  return JSON.parse(text);
}
