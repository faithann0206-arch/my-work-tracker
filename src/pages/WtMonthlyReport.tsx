import { useMemo, useState } from 'react';
import {
  Bot, Clipboard, Download, FileText, Plus, Sparkles, Trash2,
} from 'lucide-react';
import { useWt } from '@/store/wt';
import { anthropicMessage } from '@/lib/secureApi';
import type {
  MonthlyWorkCategory, MonthlyWorkStatus, WtMonthlyWorkItem,
} from '@/types/wt';

const CATEGORIES: MonthlyWorkCategory[] = [
  'Attendance',
  'Leave',
  'Official letters',
  'Email follow-up',
  'Policy / compliance',
  'Reporting',
  'Other',
];

const STATUSES: MonthlyWorkStatus[] = [
  'Completed',
  'In progress',
  'Pending management',
  'Carried forward',
];

function thisMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthLabel(month: string) {
  const [year, rawMonth] = month.split('-').map(Number);
  if (!year || !rawMonth) return month;
  return new Date(year, rawMonth - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function groupByCategory(items: WtMonthlyWorkItem[]) {
  return items.reduce<Record<string, WtMonthlyWorkItem[]>>((acc, item) => {
    acc[item.category] = acc[item.category] || [];
    acc[item.category].push(item);
    return acc;
  }, {});
}

function buildDraft(month: string, items: WtMonthlyWorkItem[], emailSubjects: string[]) {
  const grouped = groupByCategory(items);
  const lines: string[] = [];
  lines.push(`Monthly Work Report - ${monthLabel(month)}`);
  lines.push('');
  lines.push('Overview');
  lines.push(`During ${monthLabel(month)}, work was recorded across ${Object.keys(grouped).length || 0} area(s), with ${items.length} tracked item(s).`);
  if (emailSubjects.length) {
    lines.push(`${emailSubjects.length} email follow-up(s) were also logged for reference.`);
  }
  lines.push('');
  lines.push('Work Completed / Handled');

  if (!items.length) {
    lines.push('- No work items have been recorded for this month yet.');
  } else {
    Object.entries(grouped).forEach(([category, categoryItems]) => {
      lines.push('');
      lines.push(category);
      categoryItems.forEach(item => {
        const outcome = item.outcome.trim() ? ` Outcome: ${item.outcome.trim()}` : '';
        const details = item.details.trim() ? ` ${item.details.trim()}` : '';
        lines.push(`- ${item.date}: ${item.title.trim()} (${item.status}).${details}${outcome}`);
      });
    });
  }

  const carried = items.filter(item => item.status === 'Carried forward' || item.status === 'Pending management');
  lines.push('');
  lines.push('Pending / Carried Forward');
  if (carried.length) {
    carried.forEach(item => lines.push(`- ${item.title} - ${item.status}${item.outcome ? ` (${item.outcome})` : ''}`));
  } else {
    lines.push('- No pending or carried forward items recorded.');
  }

  if (emailSubjects.length) {
    lines.push('');
    lines.push('Email Follow-ups Logged');
    emailSubjects.forEach(subject => lines.push(`- ${subject}`));
  }

  return lines.join('\n');
}

function downloadDoc(month: string, report: string) {
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Monthly Work Report - ${escapeHtml(monthLabel(month))}</title>
  <style>
    body { font-family: Calibri, Arial, sans-serif; color: #111827; line-height: 1.45; }
    h1 { font-size: 22px; margin-bottom: 16px; }
    pre { white-space: pre-wrap; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
  </style>
</head>
<body>
  <h1>Monthly Work Report - ${escapeHtml(monthLabel(month))}</h1>
  <pre>${escapeHtml(report)}</pre>
</body>
</html>`;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Monthly_Work_Report_${month}.doc`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export default function WtMonthlyReport() {
  const {
    monthlyWork, emails, addMonthlyWork, updateMonthlyWork, deleteMonthlyWork,
  } = useWt();
  const [month, setMonth] = useState(thisMonth());
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<MonthlyWorkCategory>('Attendance');
  const [status, setStatus] = useState<MonthlyWorkStatus>('Completed');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [outcome, setOutcome] = useState('');
  const [includeEmails, setIncludeEmails] = useState(true);
  const [report, setReport] = useState('');
  const [message, setMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const monthItems = useMemo(
    () => monthlyWork
      .filter(item => item.month === month)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)),
    [monthlyWork, month],
  );

  const monthEmails = useMemo(
    () => emails
      .filter(email => email.date.startsWith(month))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(email => `${email.date}: ${email.subject} (${email.category})`),
    [emails, month],
  );

  const statusCounts = useMemo(() => ({
    completed: monthItems.filter(item => item.status === 'Completed').length,
    pending: monthItems.filter(item => item.status === 'Pending management').length,
    carried: monthItems.filter(item => item.status === 'Carried forward').length,
  }), [monthItems]);

  function resetForm() {
    setDate(new Date().toISOString().slice(0, 10));
    setCategory('Attendance');
    setStatus('Completed');
    setTitle('');
    setDetails('');
    setOutcome('');
  }

  function handleAdd() {
    if (!title.trim()) return;
    addMonthlyWork({
      month,
      date,
      category,
      title: title.trim(),
      details: details.trim(),
      outcome: outcome.trim(),
      status,
    });
    resetForm();
    setMessage('Work item saved.');
  }

  function handleDraft() {
    const draft = buildDraft(month, monthItems, includeEmails ? monthEmails : []);
    setReport(draft);
    setMessage('Draft report created without AI.');
  }

  async function handleAiPolish() {
    const baseDraft = buildDraft(month, monthItems, includeEmails ? monthEmails : []);
    setIsGenerating(true);
    setMessage('');
    try {
      const data = await anthropicMessage({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1800,
        messages: [{
          role: 'user',
          content: `Rewrite this as a professional monthly work report in first person or neutral office style. Keep it audit-safe, clear, factual, and not exaggerated. Mention completed work, pending management items, carried forward items, and email follow-ups only as supporting evidence. Do not invent work not listed.\n\n${baseDraft}`,
        }],
      });
      const text = data.content?.find(part => part.type === 'text')?.text || '';
      setReport(text.trim() || baseDraft);
      setMessage('AI polished the monthly report.');
    } catch (err) {
      setReport(baseDraft);
      setMessage(err instanceof Error && err.message === 'LOGIN_REQUIRED'
        ? 'Please log in again. I created the non-AI draft instead.'
        : 'AI was unavailable, so I created the non-AI draft instead.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyReport() {
    if (!report.trim()) handleDraft();
    const text = report.trim() || buildDraft(month, monthItems, includeEmails ? monthEmails : []);
    await navigator.clipboard.writeText(text);
    setMessage('Report copied.');
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Monthly Report</h1>
        <p className="text-slate-500 text-sm mt-0.5">Track your monthly work and generate a ready-to-edit report</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Month</div>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <Metric label="Work items" value={monthItems.length} />
        <Metric label="Completed" value={statusCounts.completed} tone="green" />
        <Metric label="Pending / carried" value={statusCounts.pending + statusCounts.carried} tone="amber" />
      </div>

      <div className="grid lg:grid-cols-[420px_1fr] gap-5">
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 mb-4">Add work item</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" />
                </Field>
                <Field label="Status">
                  <select value={status} onChange={e => setStatus(e.target.value as MonthlyWorkStatus)} className="input">
                    {STATUSES.map(value => <option key={value}>{value}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Category">
                <select value={category} onChange={e => setCategory(e.target.value as MonthlyWorkCategory)} className="input">
                  {CATEGORIES.map(value => <option key={value}>{value}</option>)}
                </select>
              </Field>
              <Field label="Work done">
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Prepared attendance follow-up list"
                  className="input"
                />
              </Field>
              <Field label="Details">
                <textarea
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  rows={4}
                  placeholder="Paste notes, actions taken, names, or short background..."
                  className="input resize-y"
                />
              </Field>
              <Field label="Outcome / next step">
                <textarea
                  value={outcome}
                  onChange={e => setOutcome(e.target.value)}
                  rows={3}
                  placeholder="e.g. Sent to management, approval pending, completed..."
                  className="input resize-y"
                />
              </Field>
              <button
                onClick={handleAdd}
                disabled={!title.trim()}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium text-sm px-4 py-2 rounded-lg"
              >
                <Plus size={15} />
                Save item
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="font-semibold text-slate-800">Report controls</h2>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={includeEmails}
                  onChange={e => setIncludeEmails(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Include email subjects
              </label>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button onClick={handleDraft} className="action-button bg-slate-700 hover:bg-slate-800">
                <FileText size={15} />
                Create draft without AI
              </button>
              <button onClick={handleAiPolish} disabled={isGenerating} className="action-button bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300">
                {isGenerating ? <Bot size={15} className="animate-pulse" /> : <Sparkles size={15} />}
                {isGenerating ? 'Polishing...' : 'Polish with Claude'}
              </button>
              <button onClick={copyReport} className="action-button bg-emerald-600 hover:bg-emerald-700">
                <Clipboard size={15} />
                Copy report
              </button>
              <button
                onClick={() => downloadDoc(month, report || buildDraft(month, monthItems, includeEmails ? monthEmails : []))}
                className="action-button bg-indigo-600 hover:bg-indigo-700"
              >
                <Download size={15} />
                Download Word report
              </button>
            </div>
            {message && <div className="mt-3 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">{message}</div>}
            {monthEmails.length > 0 && (
              <div className="mt-3 text-xs text-slate-500">
                {monthEmails.length} email subject{monthEmails.length !== 1 ? 's' : ''} available for this month.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5 min-w-0">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Work items for {monthLabel(month)}</h2>
              <span className="text-xs text-slate-500">{monthItems.length} item{monthItems.length !== 1 ? 's' : ''}</span>
            </div>
            {monthItems.length === 0 ? (
              <div className="px-5 py-12 text-center text-slate-400 text-sm">No work items added for this month yet.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {monthItems.map(item => (
                  <WorkItemRow
                    key={item.id}
                    item={item}
                    onDelete={deleteMonthlyWork}
                    onStatusChange={(statusValue) => updateMonthlyWork(item.id, { status: statusValue })}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-slate-800">Generated report</h2>
            </div>
            <textarea
              value={report}
              onChange={e => setReport(e.target.value)}
              rows={18}
              placeholder="Your generated monthly report will appear here. You can edit it before copying or downloading."
              className="w-full border-0 p-5 text-sm text-slate-700 resize-y focus:outline-none font-sans leading-relaxed"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = 'blue' }: { label: string; value: number; tone?: 'blue' | 'green' | 'amber' }) {
  const colors = {
    blue: 'text-blue-600',
    green: 'text-emerald-600',
    amber: 'text-amber-600',
  };
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
      <div className="text-xs font-semibold text-slate-500 uppercase">{label}</div>
      <div className={`text-3xl font-bold mt-2 ${colors[tone]}`}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

function WorkItemRow({
  item, onDelete, onStatusChange,
}: {
  item: WtMonthlyWorkItem;
  onDelete: (id: string) => void;
  onStatusChange: (status: MonthlyWorkStatus) => void;
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs text-slate-500">{item.date}</span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{item.category}</span>
          </div>
          <div className="font-semibold text-sm text-slate-800">{item.title}</div>
          {item.details && <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{item.details}</p>}
          {item.outcome && <p className="text-xs text-slate-500 mt-2">Outcome: {item.outcome}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={item.status}
            onChange={e => onStatusChange(e.target.value as MonthlyWorkStatus)}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white"
          >
            {STATUSES.map(value => <option key={value}>{value}</option>)}
          </select>
          <button
            onClick={() => onDelete(item.id)}
            className="text-red-300 hover:text-red-600 p-1"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
