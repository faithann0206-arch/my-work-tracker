import { useState, useMemo } from 'react';
import { Plus, Trash2, Search, ChevronDown, ChevronUp, Mail } from 'lucide-react';
import { useWt } from '@/store/wt';
import type { WtEmail, EmailCategory, EmailDirection } from '@/types/wt';

const CATEGORIES: EmailCategory[] = [
  'Attendance', 'Leave', 'Absence', 'Official letter', 'Policy instruction', 'Other',
];

const DIRECTIONS: EmailDirection[] = [
  'Received from management', 'Sent to management',
];

export default function WtEmailLog() {
  const { emails, addEmail, deleteEmail } = useWt();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');

  // Form state
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [direction, setDirection] = useState<EmailDirection>('Received from management');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<EmailCategory>('Attendance');
  const [body, setBody] = useState('');

  const sorted = useMemo(() =>
    [...emails].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [emails]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(e =>
      e.subject.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.body.toLowerCase().includes(q) ||
      e.direction.toLowerCase().includes(q)
    );
  }, [sorted, search]);

  function handleAdd() {
    if (!subject.trim()) return;
    addEmail({ date, direction, subject: subject.trim(), category, body });
    setDate(new Date().toISOString().slice(0, 10));
    setDirection('Received from management');
    setSubject('');
    setCategory('Attendance');
    setBody('');
    setShowForm(false);
  }

  const receivedCount = emails.filter(e => e.direction === 'Received from management').length;
  const sentCount = emails.filter(e => e.direction === 'Sent to management').length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Email Log</h1>
        <p className="text-slate-500 text-sm mt-0.5">Audit trail of emails with management</p>
      </div>

      {/* Stats + controls */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <span className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-100 px-3 py-1 rounded-full font-medium">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          {receivedCount} received
        </span>
        <span className="flex items-center gap-1.5 text-xs text-green-700 bg-green-100 px-3 py-1 rounded-full font-medium">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          {sentCount} sent
        </span>
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search subject, category, body..."
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus size={14} />
          Log email
          {showForm ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Direction</label>
              <select
                value={direction}
                onChange={e => setDirection(e.target.value as EmailDirection)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Subject *</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as EmailCategory)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Email body <span className="text-slate-400 font-normal">(for audit trail — never shown in reports)</span>
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={5}
              placeholder="Paste full email body here..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y bg-white font-mono"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!subject.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-slate-600 hover:text-slate-800 text-sm px-4 py-1.5 border border-gray-300 rounded-lg transition-colors bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Email list */}
      {filtered.length === 0 ? (
        <div className="text-center py-14 text-slate-400 text-sm">
          {search ? 'No emails match your search.' : 'No emails logged yet. Click "Log email" to start.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(email => (
            <EmailCard key={email.id} email={email} onDelete={deleteEmail} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmailCard({ email, onDelete }: { email: WtEmail; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isReceived = email.direction === 'Received from management';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${isReceived ? 'bg-blue-500' : 'bg-green-500'}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">{email.subject}</div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-xs text-slate-500">{email.date}</span>
                  <span className="text-xs text-slate-300">·</span>
                  <span className={`text-xs font-medium ${isReceived ? 'text-blue-600' : 'text-green-600'}`}>
                    {isReceived ? 'Received' : 'Sent'}
                  </span>
                  <span className="text-xs text-slate-300">·</span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">{email.category}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {email.body && (
                  <button
                    onClick={() => setExpanded(e => !e)}
                    className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-0.5 px-2 py-1 rounded"
                  >
                    <Mail size={12} />
                    {expanded ? 'Hide' : 'Body'}
                  </button>
                )}
                <button
                  onClick={() => onDelete(email.id)}
                  className="text-red-300 hover:text-red-600 p-1 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {expanded && email.body && (
        <div className="border-t border-gray-100 px-5 py-3 bg-slate-50">
          <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono leading-relaxed">{email.body}</pre>
        </div>
      )}
    </div>
  );
}
 
