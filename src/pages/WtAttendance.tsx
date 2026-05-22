import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Trash2, Download, AlertTriangle, CheckCircle, Loader2, Eye, EyeOff, Key } from 'lucide-react';
import { useWt } from '@/store/wt';
import type { WtAttendanceEmployee, WtAttendanceRow, WtAttendanceSummary } from '@/types/wt';

// ─── Arabic Detection ─────────────────────────────────────────────────────────

const ARABIC_MAP: Record<string, string> = {
  'مهمة رسمية': 'Official Mission',
  'العمل عن بُعد': 'Remote Work',
  'إجازة سنوية': 'Annual Leave',
  'إجازة مرض': 'Sick Leave',
  'إجازة الوضع': 'Maternity Leave',
  'إجازة طارئة': 'Emergency Leave',
  'عسكري': 'Military Leave',
  'لم يتم تسجيل الخروج': 'Missing Punch Out',
  'لم يتم تسجيل الدخول': 'Missing Punch In',
  'غائب': 'Unauthorised Absence',
};

function detectArabic(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  for (const key of Object.keys(ARABIC_MAP)) {
    if (trimmed.includes(key)) return ARABIC_MAP[key];
  }
  return trimmed;
}

// ─── Excel Parsing ────────────────────────────────────────────────────────────

function parseMinutes(val: unknown): number {
  if (val === null || val === undefined || val === '' || String(val).trim() === 'N/A') return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : Math.round(n);
}

function parseStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(8, rows.length); i++) {
    const row = rows[i];
    if (row && row[0] && String(row[0]).toLowerCase().includes('date')) {
      return i;
    }
  }
  return 2; // fallback: row index 2 = row 3
}

function getEmployeeName(rows: unknown[][], sheetName: string): string {
  // 1. Scan first 6 rows, cols A-D, for a standalone Arabic name
  for (let r = 0; r < Math.min(6, rows.length); r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < Math.min(4, row.length); c++) {
      const val = row[c];
      if (!val) continue;
      const str = String(val).trim();
      if (str.length < 3 || str.length > 60) continue;
      if (/^(date|day|time|name|employee)/i.test(str)) continue;
      if (/^\d/.test(str)) continue;
      // Has Arabic characters but is NOT the full title line
      if (/[؀-ۿ]/.test(str) &&
          !str.includes('كشف') && !str.includes('صندوق') &&
          !str.includes('حضور') && !str.includes('الرقم')) {
        return str;
      }
    }
  }

  // 2. Extract from sheet name pattern: "Title- Employee Name- الرقم الوظيفي-N"
  //    Split on any " - " or "- " boundary
  const parts = sheetName.split(/\s*-\s*/);
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    if (part.length < 3) continue;
    if (/[؀-ۿ]/.test(part) &&
        !part.includes('الرقم') && !part.includes('الوظيفي') &&
        !part.includes('كشف') && !part.includes('صندوق')) {
      return part;
    }
  }

  return '';
}

function parseSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string
): WtAttendanceEmployee {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  const employeeName = getEmployeeName(raw, sheetName);
  const headerRowIdx = findHeaderRow(raw);
  const dataRows = raw.slice(headerRowIdx + 1);

  const rows: WtAttendanceRow[] = [];

  for (const row of dataRows) {
    if (!row || !row[0]) continue;
    const dateStr = parseStr(row[0]);
    if (!dateStr || dateStr.toLowerCase() === 'date') continue;
    // Skip summary/total rows
    if (dateStr.toLowerCase().includes('total') || dateStr.toLowerCase().includes('balance')) continue;

    const minutesLate = parseMinutes(row[7]);
    const ptUsed = parseMinutes(row[8]);
    const ptAllowance = parseMinutes(row[9]);
    const ptRemaining = parseMinutes(row[10]);

    rows.push({
      date: dateStr,
      dayName: parseStr(row[1]),
      timeIn: parseStr(row[2]),
      timeOut: parseStr(row[3]),
      totalHours: parseStr(row[4]),
      thresholdTime: parseStr(row[5]),
      expectedOut: parseStr(row[6]),
      minutesLate,
      ptUsed,
      ptAllowance,
      ptRemaining,
      arabicReason: parseStr(row[11]),
      actionTaken: parseStr(row[12]),
      remarks: parseStr(row[13]),
    });
  }

  const summary = buildSummary(rows);
  return { sheetName, employeeName, rows, summary };
}

function buildSummary(rows: WtAttendanceRow[]): WtAttendanceSummary {
  const lateDates: WtAttendanceSummary['lateDates'] = [];
  const absentDates: WtAttendanceSummary['absentDates'] = [];
  const leaveDates: WtAttendanceSummary['leaveDates'] = [];
  let missionCount = 0;
  let remoteWorkCount = 0;
  let missingPunchCount = 0;

  for (const row of rows) {
    if (row.minutesLate > 0) {
      lateDates.push({
        date: row.date,
        minutes: row.minutesLate,
        remarks: row.remarks,
        actionTaken: row.actionTaken,
      });
    }

    const arabicType = detectArabic(row.arabicReason);

    if (arabicType === 'Official Mission') missionCount++;
    if (arabicType === 'Remote Work') remoteWorkCount++;
    if (arabicType === 'Missing Punch Out' || arabicType === 'Missing Punch In') missingPunchCount++;
    if (arabicType === 'Unauthorised Absence') {
      absentDates.push({ date: row.date, remarks: row.remarks, actionTaken: row.actionTaken });
    }

    const leaveTypes = [
      'Annual Leave', 'Sick Leave', 'Maternity Leave',
      'Emergency Leave', 'Military Leave',
    ];
    if (leaveTypes.includes(arabicType)) {
      leaveDates.push({ type: arabicType, date: row.date });
    }
  }

  // PT balance: use last non-zero ptRemaining from rows
  let ptBalance = 240;
  let ptUsedTotal = 0;
  for (const row of rows) {
    if (row.ptRemaining > 0 || row.ptUsed > 0) {
      ptBalance = row.ptRemaining;
      ptUsedTotal = row.ptUsed;
    }
  }

  const ptExceeded = ptBalance < 0;
  const ptExceedByMinutes = ptExceeded ? Math.abs(ptBalance) : 0;

  const totalLateMinutes = lateDates.reduce((s, d) => s + d.minutes, 0);
  const isCompliant = lateDates.length === 0 && absentDates.length === 0;

  return {
    lateInstances: lateDates.length,
    totalLateMinutes,
    ptUsed: ptUsedTotal,
    ptBalance,
    ptExceeded,
    ptExceedByMinutes,
    missionCount,
    remoteWorkCount,
    absentCount: absentDates.length,
    missingPunchCount,
    lateDates,
    absentDates,
    leaveDates,
    status: isCompliant ? 'Compliant' : 'Flagged',
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMins(mins: number): string {
  if (mins <= 0) return '0m';
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  if (h === 0) return m + 'm';
  return h + 'h ' + m + 'm';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
}

// ─── AI Report Generation ────────────────────────────────────────────────────

async function generateAiReport(
  emp: WtAttendanceEmployee,
  apiKey: string
): Promise<{ bullets: string[]; summary: string }> {
  const s = emp.summary;

  let prompt = 'Generate an HR attendance report for the following employee data.\n\n';
  prompt += 'Employee ID: ' + emp.sheetName + '\n';
  prompt += 'Policy change date: 12 May 2026 (2026-05-12)\n';
  prompt += 'Before 12 May 2026: late calculated from 8:00 AM, deducted from personal time (PT)\n';
  prompt += 'From 12 May 2026 onwards: late calculated from 7:30 AM, NOT deducted from PT - record and report only\n\n';

  if (s.lateDates.length > 0) {
    prompt += 'LATE DATES:\n';
    for (const ld of s.lateDates) {
      prompt += ld.date + ' - ' + ld.minutes + ' minutes late.';
      if (ld.remarks) prompt += ' Remarks: ' + ld.remarks + '.';
      if (ld.actionTaken) prompt += ' Action taken: ' + ld.actionTaken + '.';
      prompt += '\n';
    }
  } else {
    prompt += 'LATE DATES: None\n';
  }

  if (s.absentDates.length > 0) {
    prompt += '\nABSENT DATES:\n';
    for (const ad of s.absentDates) {
      prompt += ad.date + ' - Unauthorised absence.';
      if (ad.remarks) prompt += ' Remarks: ' + ad.remarks + '.';
      if (ad.actionTaken) prompt += ' Action: ' + ad.actionTaken + '.';
      prompt += '\n';
    }
  }

  prompt += '\nPT used: ' + s.ptUsed + ' minutes\n';
  prompt += 'PT balance: ' + s.ptBalance + ' minutes\n';
  prompt += 'PT exceeded: ' + (s.ptExceeded ? 'Yes, by ' + s.ptExceedByMinutes + ' minutes' : 'No') + '\n';
  prompt += 'Official missions: ' + s.missionCount + '\n';
  prompt += 'Remote work days: ' + s.remoteWorkCount + '\n';

  prompt += '\nReturn your response in EXACTLY this format:\n';
  prompt += 'BULLETS:\n';
  prompt += '- DD/MM - one-line audit-safe description based on remarks\n';
  prompt += '(one bullet per late date, one per absent date)\n\n';
  prompt += 'SUMMARY:\n';
  prompt += '2-3 sentences covering total late instances, PT status, any excused dates, and policy application.\n';
  prompt += 'For dates on or after 2026-05-12: write "recorded and reported to management per new policy, no PT deduction applicable."\n';
  prompt += 'Never write "pending" for management actions - write "Management opted to communicate directly" instead.\n';

  const body = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body,
  });

  if (!resp.ok) {
    throw new Error('API error: ' + resp.status);
  }

  const data = await resp.json() as { content: Array<{ text: string }> };
  const text = data.content[0]?.text || '';

  const bulletsStart = text.indexOf('BULLETS:');
  const summaryStart = text.indexOf('SUMMARY:');

  let bulletsRaw = '';
  let summaryRaw = '';

  if (bulletsStart !== -1 && summaryStart !== -1) {
    bulletsRaw = text.slice(bulletsStart + 8, summaryStart).trim();
    summaryRaw = text.slice(summaryStart + 8).trim();
  } else if (bulletsStart !== -1) {
    bulletsRaw = text.slice(bulletsStart + 8).trim();
  } else {
    summaryRaw = text.trim();
  }

  const bullets = bulletsRaw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('-') || l.startsWith('•'))
    .map(l => l.replace(/^[-•]\s*/, ''));

  return { bullets, summary: summaryRaw };
}

function fallbackReport(emp: WtAttendanceEmployee): { bullets: string[]; summary: string } {
  const s = emp.summary;
  const bullets: string[] = [];
  for (const ld of s.lateDates) {
    bullets.push(ld.date + ' - Late log-in (' + ld.minutes + ' min).');
  }
  for (const ad of s.absentDates) {
    bullets.push(ad.date + ' - Unauthorised absence.');
  }
  const ptInfo = s.ptExceeded
    ? 'PT allowance exceeded by ' + fmtMins(s.ptExceedByMinutes) + '.'
    : 'PT balance: ' + fmtMins(s.ptBalance) + ' remaining.';
  const summary = (s.lateInstances === 0 && s.absentCount === 0)
    ? 'No attendance violations recorded. Employee is compliant. ' + ptInfo
    : s.lateInstances + ' late instance(s) totalling ' + fmtMins(s.totalLateMinutes) + '. ' + ptInfo;
  return { bullets, summary };
}

// ─── Word Document Generation ─────────────────────────────────────────────────

function buildWordDoc(
  employees: WtAttendanceEmployee[],
  reportMonth: string
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const [year, month] = reportMonth.split('-');
  const monthName = new Date(Number(year), Number(month) - 1, 1)
    .toLocaleString('en-GB', { month: 'long' });

  let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" ';
  html += 'xmlns:w="urn:schemas-microsoft-com:office:word" ';
  html += 'xmlns="http://www.w3.org/TR/REC-html40">';
  html += '<head><meta charset="utf-8">';
  html += '<style>';
  html += 'body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1a1a1a;}';
  html += 'h1{font-size:14pt;color:#1e3a5f;margin-bottom:4pt;}';
  html += 'h2{font-size:12pt;color:#1e3a5f;margin-top:18pt;margin-bottom:6pt;border-bottom:1px solid #b0c4d8;padding-bottom:3pt;}';
  html += 'h3{font-size:11pt;color:#2c5282;margin-top:12pt;margin-bottom:4pt;}';
  html += 'table{border-collapse:collapse;width:100%;margin:8pt 0;}';
  html += 'td,th{border:1px solid #cbd5e0;padding:4pt 8pt;font-size:10pt;}';
  html += 'th{background:#e8f0f8;font-weight:bold;text-align:left;}';
  html += '.note{background:#fef3c7;border:1px solid #f59e0b;padding:8pt;margin:10pt 0;font-size:10pt;}';
  html += '.green{color:#166534;font-weight:bold;}';
  html += '.red{color:#991b1b;font-weight:bold;}';
  html += '.amber{color:#92400e;font-weight:bold;}';
  html += '.hr-block{background:#f0fdf4;border:1px solid #86efac;padding:8pt;margin-top:8pt;}';
  html += '.hr-block-warn{background:#fffbeb;border:1px solid #fcd34d;padding:8pt;margin-top:8pt;}';
  html += 'ul{margin:6pt 0;padding-left:18pt;}';
  html += 'li{margin-bottom:3pt;font-size:10pt;}';
  html += 'p{margin:4pt 0;}';
  html += '.footer{margin-top:30pt;border-top:1px solid #cbd5e0;padding-top:12pt;font-size:9pt;color:#6b7280;}';
  html += '.sig-table td{border:none;width:33%;padding:4pt 0;}';
  html += '</style></head><body>';

  // Header
  html += '<h1>Employee Attendance Profiles &mdash; ' + monthName + ' ' + year + ' &mdash; Monthly Report</h1>';
  html += '<p style="font-size:10pt;color:#4b5563;">Prepared by: Faith Jacob &mdash; HR Officer &mdash; ' + dateStr + ' &mdash; <em>Confidential</em></p>';
  html += '<hr style="border:none;border-top:2px solid #1e3a5f;margin:10pt 0;"/>';

  // Note box
  html += '<div class="note"><strong>Note:</strong> Personal time calculations are presented both including and excluding late logins. ';
  html += 'Final deductions are subject to management decision.</div>';

  // Per-employee blocks
  for (const emp of employees) {
    const s = emp.summary;
    const displayName = emp.employeeName || emp.sheetName;

    html += '<h2>' + displayName + '</h2>';

    // Summary table
    html += '<table>';
    html += '<tr><th>Item</th><th>Detail</th></tr>';
    html += '<tr><td>Late instances</td><td>' + s.lateInstances + '</td></tr>';

    if (s.lateDates.length > 0) {
      const lateDatesStr = s.lateDates.map(d => d.date + ' (' + fmtMins(d.minutes) + ')').join(', ');
      html += '<tr><td>Late dates</td><td>' + lateDatesStr + '</td></tr>';
    }

    html += '<tr><td>Total late time</td><td>' + fmtMins(s.totalLateMinutes) + '</td></tr>';
    html += '<tr><td>Personal time used</td><td>' + fmtMins(s.ptUsed) + '</td></tr>';

    const ptStr = s.ptExceeded
      ? '<span class="red">Exceeded by ' + fmtMins(s.ptExceedByMinutes) + ' &#9888;</span>'
      : '<span class="green">Not exceeded &mdash; Balance: ' + fmtMins(s.ptBalance) + '</span>';
    html += '<tr><td>Personal time balance</td><td>' + ptStr + '</td></tr>';

    if (s.leaveDates.length > 0) {
      const leaveStr = s.leaveDates.map(l => l.type + ' (' + l.date + ')').join('; ');
      html += '<tr><td>Leave taken</td><td>' + leaveStr + '</td></tr>';
    }

    if (s.missionCount > 0) {
      html += '<tr><td>Official missions</td><td>' + s.missionCount + '</td></tr>';
    }
    if (s.remoteWorkCount > 0) {
      html += '<tr><td>Remote work days</td><td>' + s.remoteWorkCount + '</td></tr>';
    }
    if (s.missingPunchCount > 0) {
      html += '<tr><td>Unregistered instances</td><td>' + s.missingPunchCount + '</td></tr>';
    }
    if (s.absentCount > 0) {
      html += '<tr><td>Unauthorised absences</td><td><span class="red">' + s.absentCount + '</span></td></tr>';
    }

    html += '</table>';

    // Bullets
    if (emp.report && emp.report.bullets.length > 0) {
      html += '<ul>';
      for (const b of emp.report.bullets) {
        html += '<li>' + b + '</li>';
      }
      html += '</ul>';
    } else if (s.lateInstances > 0 || s.absentCount > 0) {
      html += '<ul>';
      for (const ld of s.lateDates) {
        html += '<li>' + ld.date + ' &mdash; Late log-in (' + fmtMins(ld.minutes) + ').</li>';
      }
      for (const ad of s.absentDates) {
        html += '<li>' + ad.date + ' &mdash; Unauthorised absence.</li>';
      }
      html += '</ul>';
    }

    // Summary paragraph
    if (emp.report && emp.report.summary) {
      html += '<p style="margin-top:8pt;">' + emp.report.summary + '</p>';
    }

    // HR Record
    if (s.status === 'Compliant') {
      html += '<div class="hr-block"><strong>HR Record:</strong> <span class="green">Compliant</span> &mdash; ';
      html += 'No attendance violations recorded. Employee attendance is compliant. ';
      html += 'Personal time used: ' + fmtMins(s.ptUsed) + ' of 4h allowance.';
      if (s.leaveDates.length > 0) {
        html += ' ' + s.leaveDates.map(l => l.type).join(', ') + ' recorded.';
      }
      html += ' Documented by HR.</div>';
    } else {
      html += '<div class="hr-block-warn"><strong>HR Record:</strong> <span class="amber">Flagged</span> &mdash; ';
      html += 'Attendance issues recorded this period. Please refer to details above.</div>';
    }
  }

  // KPI Summary
  html += '<h2>Summary — All Employees</h2>';
  const lateEmpCount = employees.filter(e => e.summary.lateInstances > 0).length;
  const ptExcCount = employees.filter(e => e.summary.ptExceeded).length;
  const absentEmpCount = employees.filter(e => e.summary.absentCount > 0).length;
  const totalMissions = employees.reduce((s, e) => s + e.summary.missionCount, 0);

  html += '<table>';
  html += '<tr><th>Metric</th><th>Value</th></tr>';
  html += '<tr><td>Total employees</td><td>' + employees.length + '</td></tr>';
  html += '<tr><td>Employees with late records</td><td>' + lateEmpCount + ' (' + Math.round(lateEmpCount / Math.max(employees.length, 1) * 100) + '%)</td></tr>';
  html += '<tr><td>Total official missions</td><td>' + totalMissions + '</td></tr>';
  html += '<tr><td>PT exceeded</td><td>' + ptExcCount + '</td></tr>';
  html += '<tr><td>Unauthorised absences (employees)</td><td>' + absentEmpCount + '</td></tr>';
  html += '</table>';

  // Footer
  html += '<div class="footer">';
  html += '<p><strong>Note:</strong> Unregistered log out or unregistered log in &mdash; No records of log in or log out appear in the attendance system. ';
  html += 'The deduction of late logins from personal time remains subject to management discretion and decision.</p>';
  html += '<table class="sig-table" style="margin-top:20pt;"><tr>';
  html += '<td><strong>Prepared by:</strong><br/>Faith Jacob<br/>HR Officer<br/>' + dateStr + '</td>';
  html += '<td></td>';
  html += '<td><strong>Management approval:</strong><br/><br/>____________________</td>';
  html += '</tr></table>';
  html += '</div>';

  html += '</body></html>';
  return html;
}

// ─── UI Components ────────────────────────────────────────────────────────────

function SummaryRow({ emp }: { emp: WtAttendanceEmployee }) {
  const s = emp.summary;
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2.5 text-sm font-medium text-slate-700">
        {emp.employeeName || emp.sheetName}
        {emp.employeeName && emp.employeeName !== emp.sheetName && (
          <span className="text-xs text-slate-400 ml-1">({emp.sheetName})</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-sm text-center">{s.lateInstances}</td>
      <td className="px-4 py-2.5 text-sm text-center">{fmtMins(s.totalLateMinutes)}</td>
      <td className="px-4 py-2.5 text-sm text-center">{fmtMins(s.ptUsed)}</td>
      <td className="px-4 py-2.5 text-sm text-center">
        {s.ptExceeded ? (
          <span className="text-red-700 font-semibold">-{fmtMins(s.ptExceedByMinutes)}</span>
        ) : (
          <span className="text-green-700">{fmtMins(s.ptBalance)}</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-sm text-center">{s.leaveDates.length > 0 ? s.leaveDates.length : '—'}</td>
      <td className="px-4 py-2.5 text-sm text-center">{s.missionCount > 0 ? s.missionCount : '—'}</td>
      <td className="px-4 py-2.5 text-sm text-center">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.status === 'Compliant' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {s.status}
        </span>
      </td>
      {emp.report ? (
        <td className="px-4 py-2.5 text-xs text-green-600 font-medium">✓ Ready</td>
      ) : (
        <td className="px-4 py-2.5 text-xs text-slate-400">—</td>
      )}
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WtAttendance() {
  const { attEmployees, setAttEmployees, updateAttEmployee, clearAttendance, apiKey, setApiKey } = useWt();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState('');
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showApiKey, setShowApiKey] = useState(false);
  const [localApiKey, setLocalApiKey] = useState(apiKey);

  const employees = Object.values(attEmployees);
  const hasData = employees.length > 0;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setSelectedFile(f);
  }

  function handleLoad() {
    if (!selectedFile) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const parsed: Record<string, WtAttendanceEmployee> = {};
        for (const sheetName of wb.SheetNames) {
          const sheet = wb.Sheets[sheetName];
          parsed[sheetName] = parseSheet(sheet, sheetName);
        }
        setAttEmployees(parsed);
      } catch (err) {
        console.error('Parse error:', err);
        alert('Failed to parse the Excel file. Please check the format.');
      }
      setLoading(false);
    };
    reader.readAsArrayBuffer(selectedFile);
  }


  async function handleGenerateAndDownload() {
    const key = localApiKey.trim();
    if (!key) {
      alert('Please enter your Anthropic API key first.');
      return;
    }
    if (key !== apiKey) setApiKey(key);

    setAiLoading(true);
    const enriched: WtAttendanceEmployee[] = [];

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      setAiStatus('Generating report ' + (i + 1) + ' of ' + employees.length + ': ' + (emp.employeeName || emp.sheetName) + '...');
      try {
        const result = await generateAiReport(emp, key);
        const updated = { ...emp, report: { ...result, generatedAt: new Date().toISOString() } };
        enriched.push(updated);
        updateAttEmployee(emp.sheetName, { report: updated.report });
      } catch (err) {
        console.warn('AI failed for', emp.sheetName, err);
        const result = fallbackReport(emp);
        const updated = { ...emp, report: { ...result, generatedAt: new Date().toISOString() } };
        enriched.push(updated);
        updateAttEmployee(emp.sheetName, { report: updated.report });
      }
    }

    setAiStatus('');
    setAiLoading(false);

    // Download immediately with fresh enriched data
    const html = buildWordDoc(enriched, reportMonth);
    triggerDownload(html, reportMonth);
  }

  function handleDownload() {
    const html = buildWordDoc(employees, reportMonth);
    triggerDownload(html, reportMonth);
  }

  function triggerDownload(html: string, month: string) {
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const [y, m] = month.split('-');
    a.download = 'Attendance_Report_' + y + '-' + m + '.doc';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleClear() {
    clearAttendance();
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Attendance</h1>
        <p className="text-slate-500 text-sm mt-0.5">Upload Excel attendance files and generate monthly reports</p>
      </div>

      {/* API Key */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Key size={14} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Anthropic API Key</span>
          <span className="text-xs text-slate-400">(required for AI report generation)</span>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={localApiKey}
              onChange={e => setLocalApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button
            onClick={() => setApiKey(localApiKey.trim())}
            className="bg-slate-700 hover:bg-slate-800 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Save key
          </button>
        </div>
      </div>

      {/* Upload section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Upload size={15} />
          Upload Attendance File
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer">
            <span className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <FileSpreadsheet size={15} />
              Choose .xlsx file
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          {selectedFile && (
            <span className="text-sm text-slate-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
              {selectedFile.name}
            </span>
          )}
          <button
            onClick={handleLoad}
            disabled={!selectedFile || loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Load file
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">All sheets will be processed. Each sheet = one employee.</p>
      </div>

      {/* Data loaded */}
      {hasData && (
        <>
          {/* Report controls */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Report month</label>
                <input
                  type="month"
                  value={reportMonth}
                  onChange={e => setReportMonth(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={handleGenerateAndDownload}
                  disabled={aiLoading}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors shadow-sm"
                >
                  {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  Generate Word Report (.doc)
                </button>

                <button
                  onClick={handleClear}
                  className="flex items-center gap-2 text-red-600 hover:text-red-800 text-sm font-medium px-4 py-2 border border-red-200 hover:border-red-400 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                  Clear data
                </button>
              </div>
            </div>

            {aiLoading && (
              <div className="mt-3 flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg">
                <Loader2 size={14} className="animate-spin" />
                {aiStatus || 'Generating report with AI analysis...'}
              </div>
            )}
          </div>

          {/* Summary table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-slate-800">Employee Summary</h2>
              <p className="text-xs text-slate-400 mt-0.5">{employees.length} employee{employees.length !== 1 ? 's' : ''} loaded</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Employee</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Late #</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Total late</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">PT used</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">PT balance</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Leave Days</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Missions</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.map(emp => (
                    <SummaryRow key={emp.sheetName} emp={emp} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-employee detail */}
          {employees.map(emp => (
            <EmployeeDetail key={emp.sheetName} emp={emp} />
          ))}
        </>
      )}

      {!hasData && !loading && (
        <div className="text-center py-20 text-slate-400">
          <FileSpreadsheet size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No attendance data loaded yet.</p>
          <p className="text-xs mt-1">Select a .xlsx file and click "Load file" to begin.</p>
        </div>
      )}
    </div>
  );
}

function EmployeeDetail({ emp }: { emp: WtAttendanceEmployee }) {
  const [open, setOpen] = useState(false);
  const s = emp.summary;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {s.status === 'Compliant' ? (
            <CheckCircle size={16} className="text-green-500" />
          ) : (
            <AlertTriangle size={16} className="text-amber-500" />
          )}
          <span className="font-semibold text-slate-800">{emp.employeeName || emp.sheetName}</span>
          {emp.employeeName && emp.employeeName !== emp.sheetName && (
            <span className="text-xs text-slate-400">({emp.sheetName})</span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.status === 'Compliant' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {s.status}
          </span>
        </div>
        <span className="text-slate-400 text-sm">{open ? '▲ Hide' : '▼ Details'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-100">
          {emp.report ? (
            <div className="mt-4 space-y-3">
              {emp.report.bullets.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Date-by-date</h4>
                  <ul className="space-y-1">
                    {emp.report.bullets.map((b, i) => (
                      <li key={i} className="text-sm text-slate-700 flex gap-2">
                        <span className="text-slate-400 shrink-0">·</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {emp.report.summary && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Summary</h4>
                  <p className="text-sm text-slate-700">{emp.report.summary}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {s.lateDates.length === 0 && s.absentDates.length === 0 ? (
                <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">
                  No attendance violations recorded. Employee is compliant. PT used: {fmtMins(s.ptUsed)} of 4h.
                </p>
              ) : (
                <>
                  {s.lateDates.map((d, i) => (
                    <div key={i} className="text-sm text-slate-700 flex gap-2">
                      <span className="text-slate-400">·</span>
                      {d.date} — Late log-in ({fmtMins(d.minutes)}).{d.remarks ? ' ' + d.remarks : ''}
                    </div>
                  ))}
                  {s.absentDates.map((d, i) => (
                    <div key={i} className="text-sm text-red-700 flex gap-2">
                      <span className="text-red-400">·</span>
                      {d.date} — Unauthorised absence.{d.remarks ? ' ' + d.remarks : ''}
                    </div>
                  ))}
                </>
              )}
              <p className="text-xs text-slate-400 mt-2">Generate AI reports for detailed analysis.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
 
