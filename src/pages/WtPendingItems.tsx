import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useWt } from '@/store/wt';
import type { LeaveLetterStatus, WtPendingItem } from '@/types/wt';

const ABSENCE_STATUSES = ['No action', 'Converted to leave', 'Report submitted', 'Resolved'];
const LEAVE_STATUSES = ['Pending approval', 'Approved', 'Rejected', 'Resolved'];
const LEAVE_LETTER_STATUSES: LeaveLetterStatus[] = [
  'Letter received',
  'Pending mgt approval',
  'Approved',
];

function borderColor(status: string): string {
  if (status === 'No action' || status === 'Rejected') return 'border-l-red-500';
  if (status === 'Resolved' || status === 'Approved') return 'border-l-green-500';
  return 'border-l-amber-500';
}

function selectColor(status: string): string {
  if (status === 'No action' || status === 'Rejected') return 'bg-red-50 border-red-300 text-red-800';
  if (status === 'Resolved' || status === 'Approved') return 'bg-green-50 border-green-300 text-green-800';
  return 'bg-amber-50 border-amber-300 text-amber-800';
}

function nextRef(items: WtPendingItem[]): string {
  const nums = items.map(p => {
    const m = p.ref.match(/\d+/);
    return m ? parseInt(m[0]) : 0;
  });
  const n = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return 'REF-' + String(n).padStart(3, '0');
}

interface CardProps {
  item: WtPendingItem;
  statuses: string[];
  onUpdate: (id: string, patch: Partial<WtPendingItem>) => void;
  onDelete: (id: string) => void;
}

function PendingCard({ item, statuses, onUpdate, onDelete }: CardProps) {
  const [editNotes, setEditNotes] = useState(false);
  const [notes, setNotes] = useState(item.notes);

  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 p-4 shadow-sm ${borderColor(item.status)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-slate-500">{item.ref}</span>
          </div>
          <div className="text-sm font-semibold text-slate-800 mb-0.5">{item.description}</div>
          {item.dates && <div className="text-xs text-slate-500 mb-2">{item.dates}</div>}
          <select
            value={item.status}
            onChange={e => onUpdate(item.id, { status: e.target.value })}
            className={`text-xs border rounded-lg px-2 py-1 font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer ${selectColor(item.status)}`}
          >
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {item.type === 'leave' && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Official letter</span>
              <select
                value={item.officialLetterStatus || 'Pending mgt approval'}
                onChange={e => onUpdate(item.id, { officialLetterStatus: e.target.value as LeaveLetterStatus })}
                className="text-xs border border-blue-200 bg-blue-50 text-blue-800 rounded-lg px-2 py-1 font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
              >
                {LEAVE_LETTER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
        <button
          onClick={() => onDelete(item.id)}
          className="text-red-300 hover:text-red-600 p-1 transition-colors shrink-0 mt-0.5"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>

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
                onClick={() => { onUpdate(item.id, { notes }); setEditNotes(false); }}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => { setNotes(item.notes); setEditNotes(false); }}
                className="text-xs text-gray-600 hover:text-gray-800 px-3 py-1 border border-gray-300 rounded-lg transition-colors"
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
            {item.notes ? item.notes : '+ Add notes'}
          </button>
        )}
      </div>
    </div>
  );
}

interface PendingListProps {
  type: 'absence' | 'leave';
}

function PendingList({ type }: PendingListProps) {
  const { pending, addPending, updatePending, deletePending } = useWt();
  const [showForm, setShowForm] = useState(false);
  const [ref, setRef] = useState('');
  const [description, setDescription] = useState('');
  const [dates, setDates] = useState('');
  const [officialLetterStatus, setOfficialLetterStatus] = useState<LeaveLetterStatus>('Pending mgt approval');
  const [notes, setNotes] = useState('');

  const items = pending
    .filter(p => p.type === type)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const statuses = type === 'absence' ? ABSENCE_STATUSES : LEAVE_STATUSES;
  const defaultStatus = type === 'absence' ? 'No action' : 'Pending approval';

  function handleAdd() {
    if (!description.trim()) return;
    addPending({
      ref: ref.trim() || nextRef(pending),
      type,
      description: description.trim(),
      dates: dates.trim(),
      status: defaultStatus,
      officialLetterStatus: type === 'leave' ? officialLetterStatus : undefined,
      notes: notes.trim(),
    });
    setRef('');
    setDescription('');
    setDates('');
    setOfficialLetterStatus('Pending mgt approval');
    setNotes('');
    setShowForm(false);
  }

  const urgentCount = items.filter(i => i.status === 'No action' || i.status === 'Rejected').length;
  const resolvedCount = items.filter(i => i.status === 'Resolved').length;

  return (
    <div>
      {/* Stats row */}
      <div className="flex items-center gap-4 mb-4">
        <span className="text-sm text-slate-500">{items.length} record{items.length !== 1 ? 's' : ''}</span>
        {urgentCount > 0 && (
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
            {urgentCount} urgent
          </span>
        )}
        {resolvedCount > 0 && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
            {resolvedCount} resolved
          </span>
        )}
        <div className="ml-auto">
          <button
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={14} />
            Add record
            {showForm ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Reference #</label>
              <input
                value={ref}
                onChange={e => setRef(e.target.value)}
                placeholder={nextRef(pending)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date(s)</label>
              <input
                value={dates}
                onChange={e => setDates(e.target.value)}
                placeholder="e.g. 12 May 2026"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of the absence or leave..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
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
          {type === 'leave' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Official letter status</label>
              <select
                value={officialLetterStatus}
                onChange={e => setOfficialLetterStatus(e.target.value as LeaveLetterStatus)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {LEAVE_LETTER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!description.trim()}
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

      {items.length === 0 ? (
        <div className="text-center py-14 text-slate-400 text-sm">
          No {type} records yet. Click "Add record" to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <PendingCard
              key={item.id}
              item={item}
              statuses={statuses}
              onUpdate={updatePending}
              onDelete={deletePending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function WtPendingItems() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Pending Items</h1>
        <p className="text-slate-500 text-sm mt-0.5">Track absences and leave items that require action</p>
      </div>

      <Tabs defaultValue="absences">
        <TabsList className="mb-5">
          <TabsTrigger value="absences">Absences</TabsTrigger>
          <TabsTrigger value="leaves">Leaves</TabsTrigger>
        </TabsList>
        <TabsContent value="absences">
          <PendingList type="absence" />
        </TabsContent>
        <TabsContent value="leaves">
          <PendingList type="leave" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
 
