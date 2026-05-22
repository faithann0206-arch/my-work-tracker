import { Briefcase, Lock } from 'lucide-react';

export default function Login({ onLogin }: { onLogin: () => void }) {
  function handleLogin() {
    localStorage.setItem('hr_auth', 'true');
    onLogin();
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <section className="w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Briefcase size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">My Work Tracker</h1>
            <p className="text-xs text-slate-500">Personal HR reminders</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-4 py-2.5 transition-colors"
        >
          <Lock size={16} />
          Open tracker
        </button>
      </section>
    </main>
  );
}
