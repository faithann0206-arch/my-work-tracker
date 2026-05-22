import { useState } from 'react';
import { useLocation } from 'wouter';
import { AlertTriangle, CheckCircle, Mail, FileText, ClipboardList, ChevronRight } from 'lucide-react';
import { useWt } from '@/store/wt';

function statusColor(status: string): string {
  if (status === 'No action' || status === 'Rejected' || status === 'Required') {
    return 'bg-red-100 text-red-800';
  }
  if (status === 'Resolved' || status === 'Approved' || status === 'Issued') {
    return 'bg-green-100 text-green-800';
  }
  if (status === 'Not required') {
    return 'bg-gray-100 text-gray-600';
  }
  return 'bg-amber-100 text-amber-800';
}

export default function WtDashboard() {
  const { pending, letters, emails } = useWt();
  const [, navigate] = useLocation();
  const [policyUrl, setPolicyUrl] = useState('');

  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);

  const pendingCount = pending.filter(p => p.status !== 'Resolved').length;
  const lettersRequired = letters.filter(l => l.status === 'Required').length;
  const emailsLogged = emails.length;
  const resolvedThisMonth = pending.filter(p =>
    p.status === 'Resolved' && p.createdAt.startsWith(thisMonth)
  ).length;

  const urgentPending = pending.filter(p => p.status === 'No action' || p.status === 'Rejected');
  const warnPending = pending.filter(p =>
    p.status === 'Converted to leave' || p.status === 'Report submitted' || p.status === 'Pending approval'
  );

  const latestPending = [...pending]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const latestEmails = [...emails]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);

  const lettersReqCount = letters.filter(l => l.status === 'Required').length;
  const lettersPendingCount = letters.filter(
    l => l.status === 'Requested' || l.status === 'Yet to be discussed'
  ).length;
  const lettersIssuedCount = letters.filter(l => l.status === 'Issued').length;

  const dateStr = now.toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">{dateStr}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pending Items</span>
            <ClipboardList size={16} className="text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-slate-800">{pendingCount}</div>
          <div className="text-xs text-slate-400 mt-1">action needed</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Letters Pending</span>
            <FileText size={16} className="text-red-500" />
          </div>
          <div className="text-3xl font-bold text-slate-800">{lettersRequired}</div>
          <div className="text-xs text-slate-400 mt-1">required</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Emails Logged</span>
            <Mail size={16} className="text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-slate-800">{emailsLogged}</div>
          <div className="text-xs text-slate-400 mt-1">total</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Resolved</span>
            <CheckCircle size={16} className="text-green-500" />
          </div>
          <div className="text-3xl font-bold text-slate-800">{resolvedThisMonth}</div>
          <div className="text-xs text-slate-400 mt-1">this month</div>
        </div>
      </div>

      {/* Alert Bar */}
      {(urgentPending.length > 0 || lettersRequired > 0 || warnPending.length > 0) && (
        <div className="mb-6 space-y-2">
          {urgentPending.length > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertTriangle size={16} className="text-red-500 shrink-0" />
              <span className="text-sm text-red-700 font-medium">
                {urgentPending.length} pending item{urgentPending.length !== 1 ? 's' : ''} require immediate action
              </span>
              <button onClick={() => navigate('/pending')} className="ml-auto text-xs text-red-600 hover:underline flex items-center gap-0.5">
                View <ChevronRight size={12} />
              </button>
            </div>
          )}
          {lettersRequired > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertTriangle size={16} className="text-red-500 shrink-0" />
              <span className="text-sm text-red-700 font-medium">
                {lettersRequired} official letter{lettersRequired !== 1 ? 's' : ''} required
              </span>
              <button onClick={() => navigate('/letters')} className="ml-auto text-xs text-red-600 hover:underline flex items-center gap-0.5">
                View <ChevronRight size={12} />
              </button>
            </div>
          )}
          {warnPending.length > 0 && urgentPending.length === 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <AlertTriangle size={16} className="text-amber-500 shrink-0" />
              <span className="text-sm text-amber-700 font-medium">
                {warnPending.length} item{warnPending.length !== 1 ? 's' : ''} in progress — follow-up may be needed
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Main column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Pending Items */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-slate-800">Pending Items</h2>
              <button onClick={() => navigate('/pending')} className="text-xs text-blue-600 hover:underline">View all</button>
            </div>
            {latestPending.length === 0 ? (
              <div className="px-5 py-10 text-center text-slate-400 text-sm">No pending items</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {latestPending.map(item => (
                  <div key={item.id} className="px-5 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-slate-500">{item.ref}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${item.type === 'absence' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>
                          {item.type}
                        </span>
                      </div>
                      <div className="text-sm text-slate-700 truncate">{item.description}</div>
                      {item.dates && <div className="text-xs text-slate-400 mt-0.5">{item.dates}</div>}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap shrink-0 ${statusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Emails */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-slate-800">Recent Emails</h2>
              <button onClick={() => navigate('/emails')} className="text-xs text-blue-600 hover:underline">View all</button>
            </div>
            {latestEmails.length === 0 ? (
              <div className="px-5 py-10 text-center text-slate-400 text-sm">No emails logged</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {latestEmails.map(email => (
                  <div key={email.id} className="px-5 py-3 flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      email.direction === 'Received from management' ? 'bg-blue-500' : 'bg-green-500'
                    }`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate">{email.subject}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">{email.date}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-400">{email.category}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className={`text-xs font-medium ${
                          email.direction === 'Received from management' ? 'text-blue-600' : 'text-green-600'
                        }`}>
                          {email.direction === 'Received from management' ? 'Received' : 'Sent'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Official Letters Summary */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-slate-800">Official Letters</h2>
              <button onClick={() => navigate('/letters')} className="text-xs text-blue-600 hover:underline">View all</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Required</span>
                <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-0.5 rounded-full min-w-[1.5rem] text-center">{lettersReqCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Pending / In progress</span>
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-0.5 rounded-full min-w-[1.5rem] text-center">{lettersPendingCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Issued</span>
                <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-0.5 rounded-full min-w-[1.5rem] text-center">{lettersIssuedCount}</span>
              </div>
              <div className="pt-1 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Total</span>
                  <span className="text-sm font-semibold text-slate-700">{letters.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Policy Check */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-slate-800">Quick Policy Check</h2>
              <p className="text-xs text-slate-400 mt-0.5">Paste a URL to open in Policy Reader</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <input
                type="url"
                value={policyUrl}
                onChange={e => setPolicyUrl(e.target.value)}
                placeholder="https://..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() => {
                  if (policyUrl.trim()) {
                    navigate('/policy?url=' + encodeURIComponent(policyUrl.trim()));
                  }
                }}
                disabled={!policyUrl.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                Open in Policy Reader
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
 
