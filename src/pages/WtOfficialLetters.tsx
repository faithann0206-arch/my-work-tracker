import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useWt } from '@/store/wt';
import type { WtOfficialLetter, LetterStatus } from '@/types/wt';

const LETTER_STATUSES: LetterStatus[] = [
  'Required', 'Requested', 'Yet to be discussed', 'Issued', 'Not required',
];

function borderColor(status: string): string {
  if (status === 'Required') return 'border-l-red-500';
  if (status === 'Issued') return 'border-l-green-500';
  if (status === 'Not required') return 'border-l-gray-400';
  return 'border-l-amber-500';
}

function statusBadge(status: string): string {
  if (status === 'Required') return 'bg-red-100 text-red-800 border-red-200';
  if (status === 'Issued') return 'bg-green-100 text-green-800 border-green-200';
  if (status === 'Not required') return 'bg-gray-100 text-gray-600 border-gray-200';
  return 'bg-amber-100 text-amber-800 border-amber-200';
}

function selectColor(status: string): string {
  if (status === 'Required') return 'bg-red-50 border-red-300 text-red-800';
  if (status === 'Issued') return 'bg-green-50 border-green-300 text-green-800';
  if (status === 'Not required') return 'bg-gray-50 border-gray-300 text-gray-700';
  return 'bg-amber-50 border-amber-300 text-amber-800';
}

function nextRef(letters: WtOfficialLetter[]): string {
  const nums = letters.map(l => {
    const m = l.ref.match(/\d+/);
    return m ? parseInt(m[0]) : 0;
  });
  const n = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return 'LTR-' + String(n).padStart(3, '0');
}

interface CardProps {
  letter: WtOfficialLetter;
  onUpdate: (id: string, patch: Partial<WtOfficialLetter>) => void;
  onDelete: (id: string) => void;
}

function LetterCard({ letter, onUpdate, onDelete }: CardProps) {
  const [editNotes, setEditNotes] = useState(false);
  const [notes, setNotes] = useState(letter.notes);

  const isNotRequired = letter.status === 'Not required';

  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 p-4 shadow-sm ${borderColor(letter.status)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-slate-500">{letter.ref}</span>
            <span className="text-xs text-slate-400">{letter.dateAdded}</span>
          </div>
          <div className="text-sm font-semibold text-slate-800 mb-2">{letter.relatesTo}</div>

          <select
            value={letter.status}
            onChange={e => onUpdate(letter.id, { status: e.target.value as LetterStatus })}
            className={`text-xs border rounded-lg px-2 py-1 font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer ${selectColor(letter.status)}`}
          >
            {LETTER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button
          onClick={() => onDelete(letter.id)}
          className="text-red-300 hover:text-red-600 p-1 transition-colors shrink-0"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Not required extra fields */}
      {isNotRequired && (
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Why not required</label>
            <input
              value={letter.notRequiredWhy}
              onChange={e => onUpdate(letter.id, { notRequiredWhy: e.target.value })}
              placeholder="Reason..."
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Who instructed</label>
              <input
                value={letter.notRequiredWhoInstructed}
                onChange={e => onUpdate(letter.id, { notRequiredWhoInstructed: e.target.value })}
                placeholder="Name / role..."
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Source</label>
              <input
                value={letter.notRequiredSource}
                onChange={e => onUpdate(letter.id, { notRequiredSource: e.target.value })}
                placeholder="Email / verbal / meeting..."
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="mt-3 border-t border-gray-50 pt-2">
        {editNotes ? (
          <div className="space-y-2">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Notes..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { onUpdate(letter.id, { notes }); setEditNotes(false); }}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => { setNotes(letter.notes); setEditNotes(false); }}
                className="text-xs text-gray-600 px-3 py-1 border border-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditNotes(true)}
            className="text-xs text-left w-full text-slate-400 hover:text-blue-600 transition-colors"
          >
            {letter.notes ? letter.notes : '+ Add notes'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function WtOfficialLetters() {
  const { letters, addLetter, updateLetter, deleteLetter } = useWt();
  const [showForm, setShowForm] = useState(false);
  const [ref, setRef] = useState('');
  const [relatesTo, setRelatesTo] = useState('');
  const [dateAdded, setDateAdded] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<LetterStatus>('Required');
  const [notes, setNotes] = useState('');

  const sorted = [...letters].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const reqCount = letters.filter(l => l.status === 'Required').length;
  const pendCount = letters.filter(l => l.status === 'Requested' || l.status === 'Yet to be discussed').length;
  const issCount = letters.filter(l => l.status === 'Issued').length;

  function handleAdd() {
    if (!relatesTo.trim()) return;
    addLetter({
      ref: ref.trim() || nextRef(letters),
      relatesTo: relatesTo.trim(),
      dateAdded,
      status,
      notes: notes.trim(),
      notRequiredWhy: '',
      notRequiredWhoInstructed: '',
      notRequiredSource: '',
    });
    setRef('');
    setRelatesTo('');
    setDateAdded(new Date().toISOString().slice(0, 10));
    setStatus('Required');
    setNotes('');
    setShowForm(false);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Official Letters</h1>
        <p className="text-slate-500 text-sm mt-0.5">Track letters required, requested, or issued</p>
      </div>

      {/* Summary badges */}
      <div className="flex items-center gap-3 mb-5">
        <span className="bg-red-100 text-red-700 text-xs font-semibold px-3 py-1 rounded-full">
          {reqCount} Required
        </span>
        <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full">
          {pendCount} In progress
        </span>
        <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
          {issCount} Issued
        </span>
        <div className="ml-auto">
          <button
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={14} />
            Add letter
            {showForm ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Reference #</label>
              <input
                value={ref}
                onChange={e => setRef(e.target.value)}
                placeholder={nextRef(letters)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date added</label>
              <input
                type="date"
                value={dateAdded}
                onChange={e => setDateAdded(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">What it relates to *</label>
            <input
              value={relatesTo}
              onChange={e => setRelatesTo(e.target.value)}
              placeholder="e.g. Sick leave certificate for March absence"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Initial status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as LetterStatus)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {LETTER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!relatesTo.trim()}
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

      {sorted.length === 0 ? (
        <div className="text-center py-14 text-slate-400 text-sm">
          No letters recorded yet. Click "Add letter" to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(letter => (
            <LetterCard
              key={letter.id}
              letter={letter}
              onUpdate={updateLetter}
              onDelete={deleteLetter}
            />
          ))}
        </div>
      )}
    </div>
  );
}
 
