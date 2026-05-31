import { useState } from 'react';
import { Briefcase, Lock, Loader2 } from 'lucide-react';
import { login } from '@/lib/secureApi';

export default function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const token = await login(username.trim(), password);
      onLogin(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <form onSubmit={handleLogin} className="w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Briefcase size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">My Work Tracker</h1>
            <p className="text-xs text-slate-500">Personal HR reminders</p>
          </div>
        </div>

        <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoComplete="username"
        />

        <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoComplete="current-password"
        />

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !username.trim() || !password}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium rounded-lg px-4 py-2.5 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
          {loading ? 'Checking...' : 'Open tracker'}
        </button>
      </form>
    </main>
  );
}
