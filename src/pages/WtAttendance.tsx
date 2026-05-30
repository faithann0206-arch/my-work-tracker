import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Trash2, Download, AlertTriangle, CheckCircle, Loader2, Eye, EyeOff, Key } from 'lucide-react';
import { useWt } from '@/store/wt';
import type { WtAttendanceEmployee, WtAttendanceRow, WtAttendanceSummary } from '@/types/wt';

// â”€â”€â”€ Arabic Detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[\u0625\u0623\u0622\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064a')
    .replace(/\u0629/g, '\u0647')
    .replace(/\s+/g, ' ')
    .trim();
}

const ARABIC_MAP: Record<string, string> = {
  'Ù…Ù‡Ù…Ø© Ø±Ø³Ù…ÙŠØ©': 'Official Mission',
  'Ø§Ù„Ø¹Ù…Ù„ Ø¹Ù† Ø¨ÙØ¹Ø¯': 'Remote Work',
  'Ø¥Ø¬Ø§Ø²Ø© Ø³Ù†ÙˆÙŠØ©': 'Annual Leave',
  'Ø¥Ø¬Ø§Ø²Ø© Ù…Ø±Ø¶': 'Sick Leave',
  'Ø¥Ø¬Ø§Ø²Ø© Ø§Ù„ÙˆØ¶Ø¹': 'Maternity Leave',
  'Ø¥Ø¬Ø§Ø²Ø© Ø·Ø§Ø±Ø¦Ø©': 'Emergency Leave',
  'Ø¹Ø³ÙƒØ±ÙŠ': 'Military Leave',
  'Ù„Ù… ÙŠØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬': 'Missing Punch Out',
  'Ù„Ù… ÙŠØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„': 'Missing Punch In',
  'ØºØ§Ø¦Ø¨': 'Unauthorised Absence',
};

function detectArabic(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  for (const key of Object.keys(ARABIC_MAP)) {
    if (trimmed.includes(key)) return ARABIC_MAP[key];
  }
  return trimmed;
}

const REASON_KEYWORDS: Array<{ match: string[]; label: string }> = [
  { match: ['Ù…Ù‡Ù…Ø© Ø±Ø³Ù…ÙŠØ©', 'official mission', 'mission'], label: 'Official Mission' },
  { match: ['Ø§Ù„Ø¹Ù…Ù„ Ø¹Ù† Ø¨Ø¹Ø¯', 'Ø¹Ù…Ù„ Ø¹Ù† Ø¨Ø¹Ø¯', 'remote work', 'remote'], label: 'Remote Work' },
  { match: ['Ø¥Ø¬Ø§Ø²Ø© Ø³Ù†ÙˆÙŠØ©', 'Ø§Ø¬Ø§Ø²Ø© Ø³Ù†ÙˆÙŠØ©', 'annual leave'], label: 'Annual Leave' },
  { match: ['Ø¥Ø¬Ø§Ø²Ø© Ù…Ø±Ø¶ÙŠØ©', 'Ø§Ø¬Ø§Ø²Ø© Ù…Ø±Ø¶ÙŠØ©', 'Ø¥Ø¬Ø§Ø²Ø© Ù…Ø±Ø¶', 'Ø§Ø¬Ø§Ø²Ø© Ù…Ø±Ø¶', 'sick leave', 'medical leave'], label: 'Sick Leave' },
  { match: ['Ø¥Ø¬Ø§Ø²Ø© Ø§Ù„ÙˆØ¶Ø¹', 'Ø§Ø¬Ø§Ø²Ø© Ø§Ù„ÙˆØ¶Ø¹', 'maternity leave'], label: 'Maternity Leave' },
  { match: ['Ø¥Ø¬Ø§Ø²Ø© Ø·Ø§Ø±Ø¦Ø©', 'Ø§Ø¬Ø§Ø²Ø© Ø·Ø§Ø±Ø¦Ø©', 'emergency leave'], label: 'Emergency Leave' },
  { match: ['Ø¹Ø³ÙƒØ±ÙŠ', 'military leave'], label: 'Military Leave' },
  { match: ['Ù„Ù… ÙŠØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬', 'missing punch out', 'missing logout', 'unregistered logout'], label: 'Missing Punch Out' },
  { match: ['Ù„Ù… ÙŠØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„', 'missing punch in', 'missing login', 'unregistered login'], label: 'Missing Punch In' },
  { match: ['ØºØ§Ø¦Ø¨', 'ØºÙŠØ§Ø¨', 'unauthorised absence', 'unauthorized absence', 'absent'], label: 'Unauthorised Absence' },
];

function detectReason(text: string): string {
  const original = detectArabic(text);
  const lower = normalizeText([text, original].join(' '));
  const directRules: Array<{ match: string[]; label: string }> = [
    { match: ['\u0645\u0647\u0645\u0647 \u0631\u0633\u0645\u064a\u0647'], label: 'Official Mission' },
    { match: ['\u0627\u0644\u0639\u0645\u0644 \u0639\u0646 \u0628\u0639\u062f', '\u0639\u0645\u0644 \u0639\u0646 \u0628\u0639\u062f'], label: 'Remote Work' },
    { match: ['\u0627\u062c\u0627\u0632\u0647 \u0633\u0646\u0648\u064a\u0647'], label: 'Annual Leave' },
    { match: ['\u0627\u062c\u0627\u0632\u0647 \u0645\u0631\u0636\u064a\u0647', '\u0627\u062c\u0627\u0632\u0647 \u0645\u0631\u0636'], label: 'Sick Leave' },
    { match: ['\u0627\u062c\u0627\u0632\u0647 \u0627\u0644\u0648\u0636\u0639'], label: 'Maternity Leave' },
    { match: ['\u0627\u062c\u0627\u0632\u0647 \u0637\u0627\u0631\u0626\u0647'], label: 'Emergency Leave' },
    { match: ['\u0639\u0633\u0643\u0631\u064a'], label: 'Military Leave' },
    { match: ['\u0644\u0645 \u064a\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c'], label: 'Missing Punch Out' },
    { match: ['\u0644\u0645 \u064a\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644', '\u063a\u064a\u0631 \u0645\u0633\u062c\u0644 \u062f\u062e\u0648\u0644'], label: 'Missing Punch In' },
    { match: ['\u063a\u0627\u0626\u0628', '\u063a\u064a\u0627\u0628'], label: 'Unauthorised Absence' },
    { match: ['\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0627\u0644\u0645\u062a\u0627\u062e\u0631 \u0628\u0639\u062f \u0627\u0644\u0633\u0627\u0639\u0647 \u0627\u0644\u062b\u0627\u0645\u0646\u0647'], label: 'Late Login' },
    { match: ['\u0645\u063a\u0627\u062f\u0631\u0647 \u0645\u0642\u0631 \u0627\u0644\u0639\u0645\u0644 \u0628\u062a\u0635\u0631\u064a\u062d \u0644\u0627\u0633\u0628\u0627\u0628 \u0634\u062e\u0635\u064a\u0647', '\u0645\u063a\u0627\u062f\u0631\u0647 \u0645\u0642\u0631 \u0627\u0644\u0639\u0645\u0644', '\u062a\u0635\u0631\u064a\u062d \u0644\u0627\u0633\u0628\u0627\u0628 \u0634\u062e\u0635\u064a\u0647'], label: 'Permitted Early Leave' },
    { match: ['Ù…Ù‡Ù…Ø© Ø±Ø³Ù…ÙŠØ©', 'official mission', 'mission'], label: 'Official Mission' },
    { match: ['Ø§Ù„Ø¹Ù…Ù„ Ø¹Ù† Ø¨Ø¹Ø¯', 'Ø¹Ù…Ù„ Ø¹Ù† Ø¨Ø¹Ø¯', 'remote work', 'remote'], label: 'Remote Work' },
    { match: ['Ø¥Ø¬Ø§Ø²Ø© Ø³Ù†ÙˆÙŠØ©', 'Ø§Ø¬Ø§Ø²Ø© Ø³Ù†ÙˆÙŠØ©', 'annual leave'], label: 'Annual Leave' },
    { match: ['Ø¥Ø¬Ø§Ø²Ø© Ù…Ø±Ø¶ÙŠØ©', 'Ø§Ø¬Ø§Ø²Ø© Ù…Ø±Ø¶ÙŠØ©', 'Ø¥Ø¬Ø§Ø²Ø© Ù…Ø±Ø¶', 'sick leave', 'medical leave'], label: 'Sick Leave' },
    { match: ['Ø¥Ø¬Ø§Ø²Ø© Ø§Ù„ÙˆØ¶Ø¹', 'Ø§Ø¬Ø§Ø²Ø© Ø§Ù„ÙˆØ¶Ø¹', 'maternity leave'], label: 'Maternity Leave' },
    { match: ['Ø¥Ø¬Ø§Ø²Ø© Ø·Ø§Ø±Ø¦Ø©', 'Ø§Ø¬Ø§Ø²Ø© Ø·Ø§Ø±Ø¦Ø©', 'emergency leave'], label: 'Emergency Leave' },
    { match: ['Ø¹Ø³ÙƒØ±ÙŠ', 'military leave'], label: 'Military Leave' },
    { match: ['Ù„Ù… ÙŠØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬', 'missing punch out', 'missing logout', 'unregistered logout'], label: 'Missing Punch Out' },
    { match: ['Ù„Ù… ÙŠØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„', 'ØºÙŠØ± Ù…Ø³Ø¬Ù„ Ø¯Ø®ÙˆÙ„', 'missing punch in', 'missing login', 'unregistered login'], label: 'Missing Punch In' },
    { match: ['ØºØ§Ø¦Ø¨', 'ØºÙŠØ§Ø¨', 'unauthorised absence', 'unauthorized absence', 'absent'], label: 'Unauthorised Absence' },
    { match: ['ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø§Ù„Ù…ØªØ£Ø®Ø± Ø¨Ø¹Ø¯ Ø§Ù„Ø³Ø§Ø¹Ø© Ø§Ù„Ø«Ø§Ù…Ù†Ø©', 'late login', 'late log-in'], label: 'Late Login' },
    { match: ['Ù…ØºØ§Ø¯Ø±Ø© Ù…Ù‚Ø± Ø§Ù„Ø¹Ù…Ù„ Ø¨ØªØµØ±ÙŠØ­ Ù„Ø£Ø³Ø¨Ø§Ø¨ Ø´Ø®ØµÙŠØ©', 'Ù…ØºØ§Ø¯Ø±Ø© Ù…Ù‚Ø± Ø§Ù„Ø¹Ù…Ù„', 'ØªØµØ±ÙŠØ­ Ù„Ø£Ø³Ø¨Ø§Ø¨ Ø´Ø®ØµÙŠØ©', 'early leave', 'left early'], label: 'Permitted Early Leave' },
  ];
  for (const entry of directRules) {
    if (entry.match.some(keyword => lower.includes(normalizeText(keyword)))) {
      return entry.label;
    }
  }
  for (const entry of REASON_KEYWORDS) {
    if (entry.match.some(keyword => lower.includes(normalizeText(keyword)))) {
      return entry.label;
    }
  }
  return original;
}

function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function classifyAuditMeaning(row: WtAttendanceRow, detectedReason: string): { category: string; auditMeaning: string } | null {
  const reason = detectedReason || row.arabicReason;
  const combined = [reason, row.actionTaken, row.remarks].filter(Boolean).join(' ').toLowerCase();
  const normalized = normalizeText([reason, row.arabicReason, row.actionTaken, row.remarks].filter(Boolean).join(' '));

  if (!combined.trim()) return null;
  if (/^(n\/a|na|-|none|nil)$/i.test(combined.trim())) return null;

  if (row.minutesLate > 0) {
    return {
      category: 'Late log-in',
      auditMeaning: 'Late attendance entry requires policy treatment, including whether PT deduction applies or management reporting is sufficient.',
    };
  }

  if (reason === 'Unauthorised Absence' || normalized.includes('\u063a\u0627\u0626\u0628') || normalized.includes('\u063a\u064a\u0627\u0628')) {
    return {
      category: 'Absence',
      auditMeaning: 'Absence-related entry requires supporting approval, leave conversion, or management instruction before it is treated as cleared.',
    };
  }

  if (reason.includes('Missing Punch') || normalized.includes('\u0644\u0645 \u064a\u062a\u0645 \u062a\u0633\u062c\u064a\u0644') || normalized.includes('\u063a\u064a\u0631 \u0645\u0633\u062c\u0644')) {
    return {
      category: 'Missing punch',
      auditMeaning: 'Missing punch entry should be recorded as an attendance-system exception and supported by employee or management confirmation.',
    };
  }

  if (reason.includes('Leave') || normalized.includes('\u0627\u062c\u0627\u0632\u0647')) {
    return {
      category: 'Leave',
      auditMeaning: 'Leave-related entry should be tied to approval status and any required official letter or medical/supporting document.',
    };
  }

  if (reason === 'Official Mission' || normalized.includes('\u0645\u0647\u0645\u0647')) {
    return {
      category: 'Official mission',
      auditMeaning: 'Official mission entry should be treated as authorised duty when supported by the recorded reason or management note.',
    };
  }

  if (reason === 'Remote Work' || normalized.includes('\u0639\u0646 \u0628\u0639\u062f')) {
    return {
      category: 'Remote work',
      auditMeaning: 'Remote work entry should be treated as authorised work arrangement when supported by the recorded reason or management note.',
    };
  }

  if (reason === 'Unauthorised Absence' || normalized.includes('absent') || normalized.includes('absence') || normalized.includes('ØºØ§Ø¦Ø¨') || normalized.includes('ØºÙŠØ§Ø¨')) {
    return {
      category: 'Absence',
      auditMeaning: 'Absence-related entry requires supporting approval, leave conversion, or management instruction before it is treated as cleared.',
    };
  }

  if (reason.includes('Missing Punch') || normalized.includes('missing punch') || normalized.includes('unregistered') || normalized.includes('not registered') || normalized.includes('Ù„Ù… ÙŠØªÙ… ØªØ³Ø¬ÙŠÙ„') || normalized.includes('ØºÙŠØ± Ù…Ø³Ø¬Ù„')) {
    return {
      category: 'Missing punch',
      auditMeaning: 'Missing punch entry should be recorded as an attendance-system exception and supported by employee or management confirmation.',
    };
  }

  if (reason.includes('Leave') || normalized.includes('leave') || normalized.includes('sick') || normalized.includes('annual') || normalized.includes('Ø§Ø¬Ø§Ø²Ù‡')) {
    return {
      category: 'Leave',
      auditMeaning: 'Leave-related entry should be tied to approval status and any required official letter or medical/supporting document.',
    };
  }

  if (reason === 'Official Mission' || normalized.includes('mission') || normalized.includes('official') || normalized.includes('Ù…Ù‡Ù…Ù‡')) {
    return {
      category: 'Official mission',
      auditMeaning: 'Official mission entry should be treated as authorised duty when supported by the recorded reason or management note.',
    };
  }

  if (reason === 'Remote Work' || normalized.includes('remote') || normalized.includes('Ø¹Ù† Ø¨Ø¹Ø¯')) {
    return {
      category: 'Remote work',
      auditMeaning: 'Remote work entry should be treated as authorised work arrangement when supported by the recorded reason or management note.',
    };
  }

  if (reason === 'Unauthorised Absence' || combined.includes('absent') || combined.includes('absence') || combined.includes('ØºØ§Ø¦Ø¨') || combined.includes('ØºÙŠØ§Ø¨')) {
    return {
      category: 'Absence',
      auditMeaning: 'Absence-related entry requires supporting approval, leave conversion, or management instruction before it is treated as cleared.',
    };
  }

  if (reason.includes('Missing Punch') || combined.includes('missing punch') || combined.includes('unregistered') || combined.includes('not registered') || combined.includes('Ù„Ù… ÙŠØªÙ… ØªØ³Ø¬ÙŠÙ„')) {
    return {
      category: 'Missing punch',
      auditMeaning: 'Missing punch entry should be recorded as an attendance-system exception and supported by employee or management confirmation.',
    };
  }

  if (reason.includes('Leave') || combined.includes('leave') || combined.includes('sick') || combined.includes('annual') || combined.includes('Ø¥Ø¬Ø§Ø²Ø©') || combined.includes('Ø§Ø¬Ø§Ø²Ø©')) {
    return {
      category: 'Leave',
      auditMeaning: 'Leave-related entry should be tied to approval status and any required official letter or medical/supporting document.',
    };
  }

  if (reason === 'Official Mission' || combined.includes('mission') || combined.includes('official') || combined.includes('Ù…Ù‡Ù…Ø©')) {
    return {
      category: 'Official mission',
      auditMeaning: 'Official mission entry should be treated as authorised duty when supported by the recorded reason or management note.',
    };
  }

  if (reason === 'Remote Work' || combined.includes('remote') || combined.includes('Ø¹Ù† Ø¨Ø¹Ø¯')) {
    return {
      category: 'Remote work',
      auditMeaning: 'Remote work entry should be treated as authorised work arrangement when supported by the recorded reason or management note.',
    };
  }

  if (combined.includes('management') || combined.includes('manager') || combined.includes('approval') || combined.includes('approved')) {
    return {
      category: 'Management action',
      auditMeaning: 'Management-related note should be summarised as an instruction or approval status, without implying HR made an unsupported decision.',
    };
  }

  if (hasArabic(row.arabicReason) || hasArabic(row.remarks) || hasArabic(row.actionTaken) || combined.length > 3) {
    return {
      category: 'Remark review',
      auditMeaning: 'Recorded reason or remark requires audit-safe interpretation rather than copying the text verbatim.',
    };
  }

  return null;
}

// â”€â”€â”€ Excel Parsing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function parseMinutes(val: unknown): number {
  if (val === null || val === undefined || val === '' || String(val).trim() === 'N/A') return 0;
  const n = Number(val);
  if (!isNaN(n)) return Math.round(n);
  const str = String(val).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    return Number(match[1]) * 60 + Number(match[2]);
  }
  return 0;
}

function parseStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function isAttendanceDate(value: string): boolean {
  return /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(value.trim());
}

function isTotalOrCumulativeRow(row: unknown[]): boolean {
  const text = row.map(cell => parseStr(cell)).join(' ').toLowerCase();
  return (
    text.includes('total') ||
    text.includes('balance') ||
    text.includes('cumulative') ||
    text.includes('summary') ||
    text.includes('Ù…Ø¬Ù…ÙˆØ¹') ||
    text.includes('Ø±ØµÙŠØ¯') ||
    text.includes('Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ') ||
    text.includes('Ø§Ù„Ø§Ø¬Ù…Ø§Ù„ÙŠ')
  );
}

function parseClockMinutes(value: string): number | null {
  if (!value || value === 'N/A') return null;
  const match = value.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function isFridayRow(row: WtAttendanceRow): boolean {
  const day = normalizeText(row.dayName);
  if (day.includes('fri') || day.includes('\u0627\u0644\u062c\u0645\u0639\u0647')) return true;
  if (day.includes('fri') || day.includes('Ø§Ù„Ø¬Ù…Ø¹Ù‡')) return true;
  if (day.includes('fri') || row.dayName.includes('Ø§Ù„Ø¬Ù…Ø¹Ø©')) return true;

  const parts = row.date.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!parts) return false;
  const dayNum = Number(parts[1]);
  const monthNum = Number(parts[2]) - 1;
  let yearNum = Number(parts[3]);
  if (yearNum < 100) yearNum += 2000;
  const parsed = new Date(yearNum, monthNum, dayNum);
  return !isNaN(parsed.getTime()) && parsed.getDay() === 5;
}

function parseAttendanceDate(value: string): Date | null {
  const parts = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!parts) return null;
  const monthNum = Number(parts[1]) - 1;
  const dayNum = Number(parts[2]);
  let yearNum = Number(parts[3]);
  if (yearNum < 100) yearNum += 2000;
  const parsed = new Date(yearNum, monthNum, dayNum);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function usesNewLatePolicy(row: WtAttendanceRow): boolean {
  const parsed = parseAttendanceDate(row.date);
  if (!parsed) return false;
  return parsed >= new Date(2026, 4, 12);
}

function earlyLeaveMinutes(row: WtAttendanceRow): number {
  if (!isPermittedEarlyLeave(row)) return 0;
  if (row.earlyLeaveMinutes > 0) return row.earlyLeaveMinutes;
  const out = parseClockMinutes(row.timeOut);
  const expected = expectedOutByPolicy(row);
  if (out === null || expected === null) return 0;
  return Math.max(expected - out, 0);
}

function isPermittedEarlyLeave(row: WtAttendanceRow): boolean {
  const text = normalizeText([row.remarks, row.actionTaken, row.arabicReason].join(' '));
  if (!text.trim()) return false;
  if (
    text.includes('\u0645\u063a\u0627\u062f\u0631\u0647 \u0645\u0642\u0631 \u0627\u0644\u0639\u0645\u0644') ||
    text.includes('\u062a\u0635\u0631\u064a\u062d \u0644\u0627\u0633\u0628\u0627\u0628 \u0634\u062e\u0635\u064a\u0647') ||
    text.includes('\u0628\u062a\u0635\u0631\u064a\u062d') ||
    text.includes('\u062e\u0631\u0648\u062c \u0645\u0628\u0643\u0631') ||
    text.includes('\u0627\u0633\u062a\u0626\u0630\u0627\u0646') ||
    text.includes('\u0627\u0630\u0646') ||
    text.includes('Ù…ØºØ§Ø¯Ø±Ù‡ Ù…Ù‚Ø± Ø§Ù„Ø¹Ù…Ù„') ||
    text.includes('ØªØµØ±ÙŠØ­ Ù„Ø§Ø³Ø¨Ø§Ø¨ Ø´Ø®ØµÙŠÙ‡') ||
    text.includes('Ø¨ØªØµØ±ÙŠØ­') ||
    text.includes('Ø®Ø±ÙˆØ¬ Ù…Ø¨ÙƒØ±') ||
    text.includes('Ø§Ø³ØªØ¦Ø°Ø§Ù†') ||
    text.includes('Ø§Ø°Ù†')
  ) return true;
  return (
    text.includes('early') ||
    text.includes('permission') ||
    text.includes('permitted') ||
    text.includes('approved') ||
    text.includes('left early') ||
    text.includes('Ø®Ø±ÙˆØ¬ Ù…Ø¨ÙƒØ±') ||
    text.includes('Ø§Ø³ØªØ¦Ø°Ø§Ù†') ||
    text.includes('Ø¥Ø°Ù†') ||
    text.includes('Ø§Ø°Ù†')
  );
}

function lateMinutesByPolicy(row: WtAttendanceRow): number {
  if (!usesNewLatePolicy(row)) return Math.max(row.minutesLate, 0);
  const timeIn = parseClockMinutes(row.timeIn);
  if (timeIn === null) return Math.max(row.minutesLate, 0);
  const policyStart = 7 * 60 + 30;
  const eightAm = 8 * 60;
  return timeIn >= eightAm ? Math.max(timeIn - policyStart, 0) : 0;
}

function expectedOutByPolicy(row: WtAttendanceRow): number | null {
  const timeIn = parseClockMinutes(row.timeIn);
  if (timeIn === null) return parseClockMinutes(row.expectedOut);
  const policyStart = 7 * 60 + 30;
  const eightAm = 8 * 60;
  const sevenHours = 7 * 60;

  if (timeIn <= policyStart) return policyStart + sevenHours;
  if (timeIn <= eightAm) return timeIn + sevenHours;
  return eightAm + sevenHours;
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
  for (let r = 0; r < Math.min(5, rows.length); r++) {
    const text = rows[r]?.map(cell => parseStr(cell)).filter(Boolean).join(' ');
    const normalized = normalizeText(text || '');
    if (!text || (!normalized.includes('\u0643\u0634\u0641 \u062d\u0636\u0648\u0631') && !normalized.includes('\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0648\u0638\u064a\u0641\u064a'))) continue;

    const parts = text.split('-').map(part => part.trim()).filter(Boolean);
    const namePart = parts.find(part => {
      const clean = normalizeText(part);
      return (
        clean.length > 1 &&
        !clean.includes('\u0643\u0634\u0641 \u062d\u0636\u0648\u0631') &&
        !clean.includes('\u0635\u0646\u062f\u0648\u0642') &&
        !clean.includes('\u0627\u0644\u0631\u0642\u0645') &&
        !clean.includes('\u0627\u0644\u0648\u0638\u064a\u0641\u064a') &&
        !/^\d+$/.test(clean)
      );
    });
    if (namePart) return namePart;
  }

  for (let r = 0; r < Math.min(5, rows.length); r++) {
    const text = rows[r]?.map(cell => parseStr(cell)).filter(Boolean).join(' ');
    const normalized = normalizeText(text || '');
    if (!text || (!normalized.includes('ÙƒØ´Ù Ø­Ø¶ÙˆØ±') && !normalized.includes('Ø§Ù„Ø±Ù‚Ù… Ø§Ù„ÙˆØ¸ÙŠÙÙŠ'))) continue;

    const parts = text.split('-').map(part => part.trim()).filter(Boolean);
    const namePart = parts.find(part => {
      const clean = normalizeText(part);
      return (
        clean.length > 1 &&
        !clean.includes('ÙƒØ´Ù Ø­Ø¶ÙˆØ±') &&
        !clean.includes('ØµÙ†Ø¯ÙˆÙ‚') &&
        !clean.includes('Ø§Ù„Ø±Ù‚Ù…') &&
        !clean.includes('Ø§Ù„ÙˆØ¸ÙŠÙÙŠ') &&
        !/^\d+$/.test(clean)
      );
    });
    if (namePart) return namePart;
  }

  for (let r = 0; r < Math.min(4, rows.length); r++) {
    const text = rows[r]?.map(cell => parseStr(cell)).filter(Boolean).join(' ');
    if (!text || (!text.includes('ÙƒØ´Ù Ø­Ø¶ÙˆØ±') && !text.includes('Ø§Ù„Ø±Ù‚Ù… Ø§Ù„ÙˆØ¸ÙŠÙÙŠ'))) continue;
    const parts = text.split('-').map(part => part.trim()).filter(Boolean);
    const namePart = parts.find(part =>
      !part.includes('ÙƒØ´Ù Ø­Ø¶ÙˆØ±') &&
      !part.includes('Ø§Ù„Ø±Ù‚Ù…') &&
      !part.includes('Ø§Ù„ÙˆØ¸ÙŠÙÙŠ') &&
      !/^\d+$/.test(part)
    );
    if (namePart) return namePart;
    if (parts.length >= 2) return parts[1];
  }

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
      if (/[\u0600-\u06FF]/.test(str) &&
          !str.includes('ÙƒØ´Ù') && !str.includes('ØµÙ†Ø¯ÙˆÙ‚') &&
          !str.includes('Ø­Ø¶ÙˆØ±') && !str.includes('Ø§Ù„Ø±Ù‚Ù…')) {
        return str;
      }
    }
  }

  // 2. Extract from sheet name pattern: "Title- Employee Name- Ø§Ù„Ø±Ù‚Ù… Ø§Ù„ÙˆØ¸ÙŠÙÙŠ-N"
  //    Split on any " - " or "- " boundary
  const parts = sheetName.split(/\s*-\s*/);
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    if (part.length < 3) continue;
    if (/[\u0600-\u06FF]/.test(part) &&
        !part.includes('Ø§Ù„Ø±Ù‚Ù…') && !part.includes('Ø§Ù„ÙˆØ¸ÙŠÙÙŠ') &&
        !part.includes('ÙƒØ´Ù') && !part.includes('ØµÙ†Ø¯ÙˆÙ‚')) {
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
    if (isTotalOrCumulativeRow(row)) continue;
    const dateStr = parseStr(row[0]);
    if (!dateStr || dateStr.toLowerCase() === 'date') continue;
    if (!isAttendanceDate(dateStr)) continue;
    // Skip summary/total rows
    if (dateStr.toLowerCase().includes('total') || dateStr.toLowerCase().includes('balance')) continue;

    const minutesLate = parseMinutes(row[7]);
    const earlyLeave = parseMinutes(row[8]);
    const ptUsed = earlyLeave;
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
      earlyLeaveMinutes: earlyLeave,
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

function isSummaryOrGroupSheet(emp: WtAttendanceEmployee): boolean {
  const label = [emp.sheetName, emp.employeeName].join(' ').toLowerCase();
  const compact = label.replace(/\s+/g, '');
  const normalized = normalizeText(label).replace(/\s+/g, '');
  if (normalized.includes('Ù…Ø¬Ù…ÙˆØ¹Ù‡')) return false;
  return (
    compact.includes('summary') ||
    compact.includes('total') ||
    compact.includes('balance') ||
    compact.includes('Ù…Ø¬Ù…ÙˆØ¹') ||
    compact.includes('Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ') ||
    compact.includes('Ø§Ù„Ø§Ø¬Ù…Ø§Ù„ÙŠ')
  );
}

function buildSummary(rows: WtAttendanceRow[]): WtAttendanceSummary {
  const lateDates: WtAttendanceSummary['lateDates'] = [];
  const earlyLeaveDates: WtAttendanceSummary['earlyLeaveDates'] = [];
  const absentDates: WtAttendanceSummary['absentDates'] = [];
  const leaveDates: WtAttendanceSummary['leaveDates'] = [];
  const auditIssues: WtAttendanceSummary['auditIssues'] = [];
  let missionCount = 0;
  let remoteWorkCount = 0;
  let missingPunchCount = 0;

  for (const row of rows) {
    const arabicType = detectReason(row.arabicReason);
    const friday = isFridayRow(row);
    const earlyMinutes = earlyLeaveMinutes(row);
    const policyLateMinutes = lateMinutesByPolicy(row);

    if (!friday && policyLateMinutes > 0) {
      lateDates.push({
        date: row.date,
        minutes: policyLateMinutes,
        remarks: row.remarks,
        actionTaken: row.actionTaken,
      });
    }

    if (!friday && earlyMinutes > 0 && arabicType !== 'Official Mission' && arabicType !== 'Remote Work') {
      earlyLeaveDates.push({
        date: row.date,
        minutes: earlyMinutes,
        balanceBefore: 0,
        balanceAfter: 0,
        remarks: row.remarks,
        actionTaken: row.actionTaken,
      });
    }

    if (arabicType === 'Official Mission') missionCount++;
    if (arabicType === 'Remote Work') remoteWorkCount++;
    if (!friday && (arabicType === 'Missing Punch Out' || arabicType === 'Missing Punch In')) missingPunchCount++;
    if (!friday && arabicType === 'Unauthorised Absence') {
      absentDates.push({ date: row.date, remarks: row.remarks, actionTaken: row.actionTaken });
    }

    const leaveTypes = [
      'Annual Leave', 'Sick Leave', 'Maternity Leave',
      'Emergency Leave', 'Military Leave',
    ];
    if (leaveTypes.includes(arabicType)) {
      leaveDates.push({
        type: arabicType,
        date: row.date,
        remarks: row.remarks,
        actionTaken: row.actionTaken,
      });
    }

    const auditMeaning = friday ? null : classifyAuditMeaning(row, arabicType);
    if (auditMeaning) {
      auditIssues.push({
        date: row.date,
        category: auditMeaning.category,
        reason: arabicType || row.arabicReason,
        actionTaken: row.actionTaken,
        remarks: row.remarks,
        auditMeaning: auditMeaning.auditMeaning,
      });
    }
  }

  let runningEarlyLeaveBalance = 240;
  for (const entry of earlyLeaveDates) {
    entry.balanceBefore = runningEarlyLeaveBalance;
    runningEarlyLeaveBalance -= entry.minutes;
    entry.balanceAfter = runningEarlyLeaveBalance;
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
  const totalEarlyLeaveMinutes = earlyLeaveDates.reduce((s, d) => s + d.minutes, 0);
  const totalAllowanceUsed = totalEarlyLeaveMinutes;
  const allowanceRemaining = runningEarlyLeaveBalance;
  const effectivePtExceeded = allowanceRemaining < 0 || ptExceeded;
  const effectivePtExceedByMinutes = allowanceRemaining < 0 ? Math.abs(allowanceRemaining) : ptExceedByMinutes;
  const reviewCategories = ['Late log-in', 'Absence', 'Missing punch', 'Management action'];
  const needsReview = auditIssues.some(issue => reviewCategories.includes(issue.category));
  const isCompliant = lateDates.length === 0 && absentDates.length === 0 && missingPunchCount === 0 && !needsReview && !effectivePtExceeded;

  return {
    lateInstances: lateDates.length,
    totalLateMinutes,
    ptUsed: totalAllowanceUsed || ptUsedTotal,
    ptBalance: allowanceRemaining,
    totalAllowanceUsed,
    allowanceRemaining,
    ptExceeded: effectivePtExceeded,
    ptExceedByMinutes: effectivePtExceedByMinutes,
    earlyLeaveCount: earlyLeaveDates.length,
    totalEarlyLeaveMinutes,
    missionCount,
    remoteWorkCount,
    absentCount: absentDates.length,
    missingPunchCount,
    lateDates,
    earlyLeaveDates,
    absentDates,
    leaveDates,
    auditIssues,
    status: isCompliant ? 'Compliant' : 'Flagged',
  };
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ AI Report Generation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ATTENDANCE_MODELS = [
  'claude-opus-4-8',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
  'claude-haiku-4-5',
  'claude-sonnet-4-20250514',
  'claude-3-7-sonnet-20250219',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-haiku-20240307',
];

async function getAvailableAnthropicModels(apiKey: string): Promise<string[]> {
  const resp = await fetch('https://api.anthropic.com/v1/models?limit=100', {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  });

  if (!resp.ok) return ATTENDANCE_MODELS;

  const data = await resp.json() as { data?: Array<{ id?: string }> };
  const available = (data.data || [])
    .map(model => model.id)
    .filter((id): id is string => Boolean(id));

  const preferred = ATTENDANCE_MODELS.filter(model => available.includes(model));
  const remainingClaudeModels = available.filter(model => model.startsWith('claude-') && !preferred.includes(model));
  return [...preferred, ...remainingClaudeModels];
}

async function callAnthropicAttendance(prompt: string, apiKey: string, model: string): Promise<string> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    if (resp.status === 401) throw new Error('INVALID_API_KEY');
    if (resp.status === 429) throw new Error('RATE_LIMITED');
    if (resp.status === 404 || errText.includes('not_found_error') || errText.includes('model:')) {
      throw new Error('MODEL_NOT_AVAILABLE');
    }
    throw new Error('API_ERROR_' + resp.status + (errText ? ': ' + errText.slice(0, 200) : ''));
  }

  const data = await resp.json() as { content: Array<{ type?: string; text?: string }> };
  return data.content
    .filter(b => !b.type || b.type === 'text')
    .map(b => b.text || '')
    .join('\n')
    .trim();
}

async function generateAiReport(
  emp: WtAttendanceEmployee,
  apiKey: string
): Promise<{ bullets: string[]; summary: string }> {
  const s = emp.summary;

  let prompt = 'Generate an HR attendance report for the following employee data.\n\n';
  prompt += 'Employee: ' + (emp.employeeName || emp.sheetName) + '\n';
  prompt += 'Employee ID / Sheet: ' + emp.sheetName + '\n';
  prompt += 'Match the style of the manual April report: concise employee attendance profile, with late instances/dates/total late time, early leaves, work exceptions, leave days, missions, remote work, missing punches, and a final status only when management action is still needed.\n';
  prompt += 'Policy change date: 12 May 2026 (2026-05-12)\n';
  prompt += 'Attendance timing policy: official shift is 7:30 AM to 2:30 PM and employee must complete 7 working hours.\n';
  prompt += 'If employee logs in after 7:30 AM and up to 8:00 AM, expected out time is 7 hours after actual login.\n';
  prompt += 'If employee logs in at or after 8:00 AM, employee can leave only at 3:00 PM and late minutes are calculated from 7:30 AM.\n';
  prompt += 'Fridays are not violations and missing Friday rows must be ignored.\n\n';

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

  if (s.earlyLeaveDates.length > 0) {
    prompt += '\nEARLY LEAVE / EARLY EXIT DATES:\n';
    for (const ed of s.earlyLeaveDates) {
      prompt += ed.date + ' - Left ' + ed.minutes + ' minutes before expected out time.';
      prompt += ' Personal 4-hour balance before: ' + ed.balanceBefore + ' minutes.';
      prompt += ' Balance after: ' + ed.balanceAfter + ' minutes.';
      if (ed.remarks) prompt += ' Remarks: ' + ed.remarks + '.';
      if (ed.actionTaken) prompt += ' Action taken: ' + ed.actionTaken + '.';
      prompt += '\n';
    }
  } else {
    prompt += '\nEARLY LEAVE / EARLY EXIT DATES: None\n';
  }

  if (s.auditIssues.length > 0) {
    prompt += '\nFULL ROW CONTEXT TO INTERPRET FOR AUDIT:\n';
    for (const issue of s.auditIssues) {
      prompt += issue.date + ' - Category: ' + issue.category + '. ';
      prompt += 'Detected reason: ' + (issue.reason || 'Not specified') + '. ';
      prompt += 'Action taken: ' + (issue.actionTaken || 'Not specified') + '. ';
      prompt += 'Remarks: ' + (issue.remarks || 'Not specified') + '. ';
      prompt += 'Audit interpretation needed: ' + issue.auditMeaning + '\n';
    }
  } else {
    prompt += '\nFULL ROW CONTEXT TO INTERPRET FOR AUDIT: None\n';
  }

  prompt += '\nPT used: ' + s.ptUsed + ' minutes\n';
  prompt += 'PT balance: ' + s.ptBalance + ' minutes\n';
  prompt += 'Total late log-ins: ' + s.lateInstances + '\n';
  prompt += 'Total early exits/leaves: ' + s.earlyLeaveCount + '\n';
  prompt += 'Total 4-hour allowance used by permitted early exits only: ' + s.totalAllowanceUsed + ' minutes\n';
  prompt += '4-hour allowance remaining: ' + s.allowanceRemaining + ' minutes\n';
  prompt += 'PT exceeded: ' + (s.ptExceeded ? 'Yes, by ' + s.ptExceedByMinutes + ' minutes' : 'No') + '\n';
  prompt += 'Official missions: ' + s.missionCount + '\n';
  prompt += 'Remote work days: ' + s.remoteWorkCount + '\n';
  prompt += 'Leave days taken: ' + (s.leaveDates.length ? s.leaveDates.map(l => l.type + ' on ' + l.date).join('; ') : 'None') + '\n';

  prompt += '\nReturn your response in EXACTLY this format:\n';
  prompt += 'BULLETS:\n';
  prompt += '- Only include 1-4 important notes. Do not list every ordinary leave day. Group repeated leaves, missions, remote-work days, and repeated late log-ins.\n';
  prompt += '- Write like a human HR officer preparing a monthly management report.\n\n';
  prompt += 'SUMMARY:\n';
  prompt += 'One concise April-report style sentence, maximum 35 words. Mention late log-ins, leave/mission/remote work, early leave allowance, and status only when relevant.\n';
  prompt += 'Do not copy remarks verbatim. Interpret them into neutral audit language.\n';
  prompt += 'If action is unresolved or unclear, write "Management review pending" rather than "audit review needed".\n';
  prompt += 'Do not treat missing Fridays as violations.\n';
  prompt += 'If an employee has leave, official mission, remote work, management approval, missing punch, or remarks, mention the audit position even if there are no late minutes.\n';
  prompt += 'Do not say management review is pending for ordinary leave, remote work, official missions, or permitted early leave that remains within the 4-hour allowance unless the row explicitly shows unresolved action.\n';
  prompt += 'Do not mark everyone compliant just because late minutes are zero. Use the row context, but keep the language natural and short.\n';
  prompt += 'For dates on or after 2026-05-12: write "recorded and reported to management per new policy, no PT deduction applicable."\n';

  let text = '';
  let lastError: unknown = null;
  const models = await getAvailableAnthropicModels(apiKey);
  for (const model of models) {
    try {
      text = await callAnthropicAttendance(prompt, apiKey, model);
      break;
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'INVALID_API_KEY' || message === 'RATE_LIMITED') throw err;
      if (message !== 'MODEL_NOT_AVAILABLE') throw err;
    }
  }

  if (!text) {
    throw lastError instanceof Error ? lastError : new Error(String(lastError || 'No AI report returned.'));
  }

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
    .filter(l => l.startsWith('-') || l.startsWith('â€¢'))
    .map(l => l.replace(/^[-â€¢]\s*/, ''));

  return { bullets, summary: summaryRaw };
}

function fallbackReport(emp: WtAttendanceEmployee): { bullets: string[]; summary: string } {
  return { bullets: employeeNotes(emp), summary: computedEmployeeSummary(emp) };
}

// â”€â”€â”€ Word Document Generation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function profileRow(label: string, value: string): string {
  return '<tr><td class="label">' + escapeHtml(label) + '</td><td>' + value + '</td></tr>';
}

function plural(value: number, singular: string, pluralWord: string): string {
  return value + ' ' + (value === 1 ? singular : pluralWord);
}

function formatLeaveSummary(s: WtAttendanceSummary): string {
  const grouped = s.leaveDates.reduce<Record<string, number>>((acc, leave) => {
    acc[leave.type] = (acc[leave.type] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(grouped)
    .map(([type, count]) => type + ' (' + plural(count, 'day', 'days') + ')')
    .join('<br/>');
}

function formatDateList(dates: Array<{ date: string }>): string {
  return dates.length ? dates.map(d => escapeHtml(d.date)).join(', ') : 'N/A';
}

function formatWorkExceptions(s: WtAttendanceSummary): string {
  const items: string[] = [];
  const leaveSummary = formatLeaveSummary(s);
  if (leaveSummary) items.push(leaveSummary);
  if (s.missionCount > 0) items.push('Official Missions (' + s.missionCount + ')');
  if (s.remoteWorkCount > 0) items.push('Remote work (' + plural(s.remoteWorkCount, 'day', 'days') + ')');
  if (s.missingPunchCount > 0) items.push('Unregistered log in/out (' + s.missingPunchCount + ')');
  if (s.absentCount > 0) items.push('Absence entries (' + s.absentCount + ')');
  return items.length ? items.join('<br/>') : 'N/A';
}

function formatLeaveDays(s: WtAttendanceSummary): string {
  return s.leaveDates.length > 0 ? plural(s.leaveDates.length, 'day', 'days') : 'N/A';
}

function formatPtInclLate(s: WtAttendanceSummary): string {
  if (s.lateInstances === 0 && s.earlyLeaveCount === 0) return 'N/A';
  const total = s.totalEarlyLeaveMinutes + s.totalLateMinutes;
  return total > 240 ? 'Exceeded by ' + fmtMins(total - 240) : 'Not Exceeded';
}

function hasManagementReview(s: WtAttendanceSummary): boolean {
  const reviewCategories = ['Late log-in', 'Absence', 'Missing punch', 'Management action'];
  return s.ptExceeded || s.auditIssues.some(issue => reviewCategories.includes(issue.category));
}

function employeeId(emp: WtAttendanceEmployee): string {
  return emp.sheetName.replace(/^Sheet/i, '');
}

function employeeDisplay(emp: WtAttendanceEmployee): string {
  return emp.employeeName || emp.sheetName;
}

function workingDaysInMonth(reportMonth: string): number {
  const [yearText, monthText] = reportMonth.split('-');
  const year = Number(yearText);
  const month = Number(monthText) - 1;
  if (!year || month < 0 || month > 11) return 0;

  const lastDay = new Date(year, month + 1, 0).getDate();
  let workingDays = 0;
  for (let day = 1; day <= lastDay; day++) {
    const weekDay = new Date(year, month, day).getDay();
    if (weekDay >= 1 && weekDay <= 5) workingDays++;
  }
  return workingDays;
}

function actualWorkingDays(emp: WtAttendanceEmployee, monthlyWorkingDays: number): number {
  return Math.max(monthlyWorkingDays - emp.summary.leaveDates.length, 0);
}

function pct(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '') + '%';
}

function signedBalance(mins: number): string {
  if (mins < 0) return '-' + fmtMins(Math.abs(mins));
  if (mins === 0) return 'Fully Consumed';
  return fmtMins(mins);
}

function leaveTextForSummary(s: WtAttendanceSummary): string {
  const grouped = s.leaveDates.reduce<Record<string, number>>((acc, leave) => {
    acc[leave.type] = (acc[leave.type] || 0) + 1;
    return acc;
  }, {});
  const parts = Object.entries(grouped).map(([type, count]) => plural(count, type.toLowerCase() + ' day', type.toLowerCase() + ' days'));
  return parts.join(', ');
}

function leaveTextForTable(s: WtAttendanceSummary): string {
  return leaveTextForSummary(s) || '-';
}

function employeeNotes(emp: WtAttendanceEmployee): string[] {
  const s = emp.summary;
  const notes: string[] = [];
  const lateWithActions = s.lateDates.filter(d => d.actionTaken || d.remarks);
  if (s.lateInstances > 0) {
    notes.push(s.lateInstances + ' late log-in' + (s.lateInstances === 1 ? '' : 's') + ' recorded; total late time ' + fmtMins(s.totalLateMinutes) + '.');
  }
  if (lateWithActions.length > 0) {
    notes.push('Late entries include recorded action/remarks and should be treated according to the applicable policy period.');
  }
  if (s.earlyLeaveCount > 0) {
    notes.push('Permitted early departures remained ' + (s.ptExceeded ? 'above' : 'within') + ' the 4-hour monthly allowance.');
  }
  if (s.missingPunchCount > 0) {
    notes.push('Missing punch entry requires attendance-system confirmation.');
  }
  if (s.missionCount > 0) {
    notes.push('Official mission entries treated as authorised duty where supported by the recorded reason or management note.');
  }
  if (s.remoteWorkCount > 0) {
    notes.push('Remote-work entries treated as authorised work arrangement where supported by the recorded reason or management note.');
  }
  const leaveText = leaveTextForSummary(s);
  if (leaveText) {
    notes.push('Leave recorded: ' + leaveText + '.');
  }
  if (notes.length === 0) {
    notes.push('No attendance exceptions recorded for this employee.');
  }
  return notes.slice(0, 4);
}

function computedEmployeeSummary(emp: WtAttendanceEmployee): string {
  const s = emp.summary;
  const name = emp.employeeName || emp.sheetName;
  const parts: string[] = [];

  if (s.lateInstances > 0) {
    parts.push(plural(s.lateInstances, 'late log-in', 'late log-ins') + ' totalling ' + fmtMins(s.totalLateMinutes));
  } else {
    parts.push('no late log-ins');
  }

  if (s.earlyLeaveCount > 0) {
    parts.push(plural(s.earlyLeaveCount, 'permitted early departure', 'permitted early departures') + ' using ' + fmtMins(s.totalEarlyLeaveMinutes) + ', leaving ' + fmtMins(Math.max(s.allowanceRemaining, 0)) + ' PT balance');
  }

  const leaveText = leaveTextForSummary(s);
  if (leaveText) parts.push(leaveText);
  if (s.missionCount > 0) parts.push(plural(s.missionCount, 'official mission', 'official missions'));
  if (s.remoteWorkCount > 0) parts.push(plural(s.remoteWorkCount, 'remote-work day', 'remote-work days'));
  if (s.missingPunchCount > 0) parts.push(plural(s.missingPunchCount, 'missing punch', 'missing punches'));

  const status = hasManagementReview(s)
    ? 'Management review pending.'
    : 'Compliant.';

  return name + ': ' + parts.join('; ') + '. ' + status;
}

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
  html += 'h1{font-size:16pt;color:#1e3a5f;margin-bottom:2pt;}';
  html += 'h2{font-size:13pt;color:#1e3a5f;margin-top:18pt;margin-bottom:6pt;border-bottom:1px solid #b0c4d8;padding-bottom:3pt;}';
  html += 'h3{font-size:11pt;color:#2c5282;margin-top:12pt;margin-bottom:4pt;}';
  html += 'table{border-collapse:collapse;width:100%;margin:8pt 0 14pt 0;}';
  html += 'td,th{border:1px solid #cbd5e0;padding:4pt 8pt;font-size:10pt;}';
  html += 'th{background:#e8f0f8;font-weight:bold;text-align:left;}';
  html += '.tight td,.tight th{font-size:9.5pt;padding:3pt 6pt;}';
  html += '.note{background:#fef3c7;border:1px solid #f59e0b;padding:8pt;margin:10pt 0;font-size:10pt;}';
  html += '.green{color:#166534;font-weight:bold;}';
  html += '.red{color:#991b1b;font-weight:bold;}';
  html += '.amber{color:#92400e;font-weight:bold;}';
  html += 'p{margin:4pt 0;}';
  html += '.small{font-size:9pt;color:#64748b;}';
  html += '.footer{margin-top:30pt;border-top:1px solid #cbd5e0;padding-top:12pt;font-size:9pt;color:#6b7280;}';
  html += '.sig-table td{border:none;width:33%;padding:4pt 0;}';
  html += '</style></head><body>';

  const totalEmployees = employees.length;
  const lateEmployees = employees.filter(e => e.summary.lateInstances > 0);
  const otherEmployees = employees.filter(e => e.summary.lateInstances === 0);
  const reviewEmployees = employees.filter(e => hasManagementReview(e.summary));
  const totalMissions = employees.reduce((sum, e) => sum + e.summary.missionCount, 0);
  const totalLeaveDays = employees.reduce((sum, e) => sum + e.summary.leaveDates.length, 0);
  const totalEarlyUsers = employees.filter(e => e.summary.earlyLeaveCount > 0).length;
  const exceededEmployees = employees.filter(e => e.summary.ptExceeded);
  const remoteEmployees = employees.filter(e => e.summary.remoteWorkCount > 0);
  const compliantEmployees = employees.filter(e => !hasManagementReview(e.summary));
  const totalLateDays = employees.reduce((sum, e) => sum + e.summary.lateInstances, 0);
  const monthlyWorkingDays = workingDaysInMonth(reportMonth);
  const totalActualWorkingDays = employees.reduce((sum, e) => sum + actualWorkingDays(e, monthlyWorkingDays), 0);
  const totalWorkingDaysForLate = lateEmployees.reduce((sum, e) => sum + actualWorkingDays(e, monthlyWorkingDays), 0);
  const combinedLateRate = totalWorkingDaysForLate > 0 ? pct((totalLateDays / totalWorkingDaysForLate) * 100) : '0%';
  const totalEmployeeLateRate = totalActualWorkingDays > 0 ? pct((totalLateDays / totalActualWorkingDays) * 100) : '0%';

  function tr(cells: string[], header = false): string {
    const tag = header ? 'th' : 'td';
    return '<tr>' + cells.map(cell => '<' + tag + '>' + cell + '</' + tag + '>').join('') + '</tr>';
  }

  function statusCell(emp: WtAttendanceEmployee): string {
    return hasManagementReview(emp.summary)
      ? '<span class="amber">Pending Management Review</span>'
      : '<span class="green">Compliant</span>';
  }

  html += '<h1>Employee Attendance Summary</h1>';
  html += '<p><strong>' + monthName + ' ' + year + '</strong></p>';
  html += '<p style="font-size:10pt;color:#4b5563;">Prepared by: Faith Jacob &mdash; HR Officer &mdash; ' + dateStr + ' &mdash; <em>Confidential</em></p>';
  html += '<hr style="border:none;border-top:2px solid #1e3a5f;margin:10pt 0;"/>';

  html += '<div class="note"><strong>Note:</strong> Personal time calculations are presented both including and excluding late logins. ';
  html += 'Late time before 12 May 2026 follows the uploaded Excel calculation; from 12 May 2026 onward, late time follows the updated 7:30 AM policy. Final deductions are subject to management decision.</div>';
  html += '<p class="small">Working days for ' + monthName + ' ' + year + ' are calculated automatically as Monday to Friday calendar days, including Fridays: ' + monthlyWorkingDays + ' working days before employee leave deductions.</p>';

  html += '<h2>Organisation KPIs</h2>';
  html += '<h3>Key Metrics</h3><table>';
  html += tr(['Metric', 'Value', 'Context'], true);
  html += tr(['Fully Compliant Employees', String(compliantEmployees.length), pct((compliantEmployees.length / Math.max(totalEmployees, 1)) * 100) + ' of reported employees']);
  html += tr(['Late Arrival Rate', pct((lateEmployees.length / Math.max(totalEmployees, 1)) * 100), lateEmployees.length + ' of ' + totalEmployees + ' employees']);
  html += tr(['Overall Employee Late %', totalEmployeeLateRate, totalLateDays + ' late days ÷ ' + totalActualWorkingDays + ' actual working days after leave deductions']);
  html += tr(['Employees with Official Missions', String(employees.filter(e => e.summary.missionCount > 0).length), totalMissions + ' total missions conducted']);
  html += tr(['Employees Who Used Personal Time', String(totalEarlyUsers), 'Permitted early departures within 4-hour monthly allowance unless noted']);
  html += tr(['Exceeded Personal Time', String(exceededEmployees.length), 'Excluding late log-ins unless management applies deduction']);
  html += tr(['Total Leave Days Taken', String(totalLeaveDays), 'All leave categories from uploaded sheet']);
  html += tr(['Employees on Remote Work', String(remoteEmployees.length), 'Authorised remote-work entries recorded']);
  html += '</table>';

  html += '<h3>Compliance Breakdown</h3><table>';
  html += tr(['Category', 'Count', 'Status'], true);
  html += tr(['Fully compliant, no violations', String(compliantEmployees.length), '<span class="green">Compliant</span>']);
  html += tr(['Late log-ins recorded', String(lateEmployees.length), '<span class="amber">Pending Management Review</span>']);
  html += tr(['Personal time used but within allowance', String(totalEarlyUsers - exceededEmployees.length), '<span class="green">Within limits</span>']);
  html += tr(['Exceeded personal time', String(exceededEmployees.length), exceededEmployees.length ? '<span class="amber">Pending Management Review</span>' : '<span class="green">None</span>']);
  html += '</table>';

  html += '<h2>Employees With Late Log-ins</h2>';
  html += '<table class="tight">';
  html += tr(['Employee', 'Leave Days', 'Official Missions', 'Late Days', 'Late %', 'Early Leave Used', 'PT Balance (excl. late)', 'PT Balance (incl. late)', 'Remarks'], true);
  for (const emp of lateEmployees) {
    const s = emp.summary;
    const workingDays = actualWorkingDays(emp, monthlyWorkingDays);
    html += tr([
      escapeHtml(employeeDisplay(emp)),
      escapeHtml(leaveTextForTable(s)),
      s.missionCount ? String(s.missionCount) : '-',
      String(s.lateInstances),
      workingDays ? pct((s.lateInstances / workingDays) * 100) : '0%',
      s.earlyLeaveCount ? fmtMins(s.totalEarlyLeaveMinutes) : '-',
      signedBalance(s.allowanceRemaining),
      signedBalance(240 - s.totalEarlyLeaveMinutes - s.totalLateMinutes),
      statusCell(emp),
    ]);
  }
  if (lateEmployees.length === 0) html += tr(['No late log-ins recorded', '-', '-', '-', '-', '-', '-', '-', '<span class="green">Compliant</span>']);
  html += '</table>';

  html += '<h2>All Other Employees</h2>';
  html += '<table class="tight">';
  html += tr(['Employee', 'Leave Days', 'Official Missions', 'Remote Work', 'Early Leave Used', 'PT Balance', 'Remarks'], true);
  for (const emp of otherEmployees) {
    const s = emp.summary;
    html += tr([
      escapeHtml(employeeDisplay(emp)),
      escapeHtml(leaveTextForTable(s)),
      s.missionCount ? String(s.missionCount) : '-',
      s.remoteWorkCount ? String(s.remoteWorkCount) : '-',
      s.earlyLeaveCount ? fmtMins(s.totalEarlyLeaveMinutes) : '-',
      signedBalance(s.allowanceRemaining),
      statusCell(emp),
    ]);
  }
  html += '</table>';

  html += '<h2>Late Log-in Frequency Breakdown</h2>';
  html += '<table class="tight">';
  html += tr(['Employee', 'Late Days', 'Actual Working Days', 'Frequency', 'Total Late Time', 'Individual Rate', 'Pattern'], true);
  for (const emp of lateEmployees.sort((a, b) => b.summary.lateInstances - a.summary.lateInstances)) {
    const s = emp.summary;
    const workingDays = actualWorkingDays(emp, monthlyWorkingDays);
    const rate = workingDays ? (s.lateInstances / workingDays) * 100 : 0;
    html += tr([
      escapeHtml(employeeDisplay(emp)),
      String(s.lateInstances),
      String(workingDays),
      s.lateInstances + ' out of ' + workingDays + ' days',
      fmtMins(s.totalLateMinutes),
      pct(rate),
      rate >= 25 ? 'Consistent' : 'Occasional',
    ]);
  }
  html += tr(['Total', String(totalLateDays), String(totalWorkingDaysForLate), totalLateDays + ' out of ' + totalWorkingDaysForLate + ' days', fmtMins(employees.reduce((sum, e) => sum + e.summary.totalLateMinutes, 0)), combinedLateRate, 'Combined frequency rate']);
  html += '</table>';
  html += '<p class="small">Late % = Late Days ÷ Actual Working Days. Actual Working Days = monthly Monday-Friday working days, including Fridays, minus that employee&apos;s leave days.</p>';

  html += '<h2>Employee Summaries</h2>';
  for (const emp of employees) {
    const s = emp.summary;
    const workingDays = actualWorkingDays(emp, monthlyWorkingDays);
    const lateRate = workingDays ? pct((s.lateInstances / workingDays) * 100) : '0%';
    const summary = emp.report?.summary || computedEmployeeSummary(emp);
    const notes = (emp.report?.bullets?.length ? emp.report.bullets : employeeNotes(emp)).slice(0, 3).join('<br/>');
    html += '<h3>' + escapeHtml(employeeDisplay(emp)) + ' (ID: ' + escapeHtml(employeeId(emp)) + ')</h3>';
    html += '<table>';
    html += tr(['Item', 'Details'], true);
    html += tr(['Late log-ins', s.lateInstances ? s.lateInstances + ' (' + fmtMins(s.totalLateMinutes) + ')' : 'None']);
    html += tr(['Late %', lateRate + ' (' + s.lateInstances + ' late days ÷ ' + workingDays + ' actual working days)']);
    html += tr(['Early leave used', s.earlyLeaveCount ? fmtMins(s.totalEarlyLeaveMinutes) + ' across ' + plural(s.earlyLeaveCount, 'entry', 'entries') : 'None']);
    html += tr(['PT balance', signedBalance(s.allowanceRemaining)]);
    html += tr(['Leave days', escapeHtml(leaveTextForTable(s))]);
    html += tr(['Official missions', s.missionCount ? String(s.missionCount) : '-']);
    html += tr(['Remote work', s.remoteWorkCount ? String(s.remoteWorkCount) : '-']);
    html += tr(['Summary', escapeHtml(summary)]);
    html += tr(['Notes', notes ? notes.split('<br/>').map(escapeHtml).join('<br/>') : '-']);
    html += tr(['Status', statusCell(emp)]);
    html += '</table>';
  }

  html += '<div class="footer">';
  html += '<p><strong>Note:</strong> Unregistered log out or unregistered log in means no records of log in or log out appear in the attendance system. Late log-ins and early departures are reported separately. Fridays are not treated as violations. Final deductions remain subject to management decision.</p>';
  html += '<table class="sig-table" style="margin-top:20pt;"><tr>';
  html += '<td><strong>Prepared by:</strong><br/>Faith Jacob<br/>HR Officer<br/>' + dateStr + '</td>';
  html += '<td></td>';
  html += '<td><strong>Management approval:</strong><br/><br/>____________________</td>';
  html += '</tr></table>';
  html += '</div>';

  html += '</body></html>';
  return '\ufeff' + html;

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
      <td className="px-4 py-2.5 text-sm text-center">{s.earlyLeaveCount}</td>
      <td className="px-4 py-2.5 text-sm text-center">{fmtMins(s.totalAllowanceUsed)}</td>
      <td className="px-4 py-2.5 text-sm text-center">
        {s.ptExceeded ? (
          <span className="text-red-700 font-semibold">-{fmtMins(s.ptExceedByMinutes)}</span>
        ) : (
          <span className="text-green-700">{fmtMins(s.allowanceRemaining)}</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-sm text-center">{s.leaveDates.length > 0 ? s.leaveDates.length : '-'}</td>
      <td className="px-4 py-2.5 text-sm text-center">{s.missionCount > 0 ? s.missionCount : '-'}</td>
      <td className="px-4 py-2.5 text-sm text-center">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.status === 'Compliant' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {s.status}
        </span>
      </td>
      {emp.report ? (
        <td className="px-4 py-2.5 text-xs text-green-600 font-medium">Ready</td>
      ) : (
        <td className="px-4 py-2.5 text-xs text-slate-400">-</td>
      )}
    </tr>
  );
}

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
          const employee = parseSheet(sheet, sheetName);
          if (!isSummaryOrGroupSheet(employee) && employee.rows.length > 0) {
            parsed[sheetName] = {
              ...employee,
              report: {
                ...fallbackReport(employee),
                generatedAt: new Date().toISOString(),
              },
            };
          }
        }
        if (Object.keys(parsed).length === 0) {
          alert('No employee attendance sheets were found. Summary/group sheets were ignored.');
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
    const aiFailures: string[] = [];

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
        aiFailures.push(emp.employeeName || emp.sheetName);
        const result = fallbackReport(emp);
        const updated = { ...emp, report: { ...result, generatedAt: new Date().toISOString() } };
        enriched.push(updated);
        updateAttEmployee(emp.sheetName, { report: updated.report });
      }
    }

    setAiStatus('');
    setAiLoading(false);

    if (aiFailures.length > 0) {
      alert('Claude did not generate summaries for ' + aiFailures.length + ' employee(s): ' + aiFailures.join(', ') + '. The downloaded report will use the non-AI April-style summary for those employees.');
    }

    // Download immediately with fresh enriched data
    const html = buildWordDoc(enriched, reportMonth);
    triggerDownload(html, reportMonth);
  }

  function handleDownload() {
    const withSummaries = employees.map(emp => ({
      ...emp,
      report: {
        ...fallbackReport(emp),
        generatedAt: new Date().toISOString(),
      },
    }));
    const html = buildWordDoc(withSummaries, reportMonth);
    triggerDownload(html, reportMonth);
  }

  function triggerDownload(html: string, month: string) {
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const [y, m] = month.split('-');
    a.download = 'Attendance_Report_' + y + '-' + m + '.doc';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1000);
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
                  onClick={handleDownload}
                  disabled={aiLoading}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors shadow-sm"
                >
                  <Download size={14} />
                  Download without AI
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
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Early leaves</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Early used</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Remaining</th>
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
        <span className="text-slate-400 text-sm">{open ? 'â–² Hide' : 'â–¼ Details'}</span>
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
                        <span className="text-slate-400 shrink-0">Â·</span>
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
              {s.lateDates.length === 0 && s.absentDates.length === 0 && s.auditIssues.length === 0 ? (
                <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">
                  No attendance exceptions or review remarks recorded. PT used: {fmtMins(s.ptUsed)} of 4h.
                </p>
              ) : (
                <>
                  {s.lateDates.map((d, i) => (
                    <div key={i} className="text-sm text-slate-700 flex gap-2">
                      <span className="text-slate-400">Â·</span>
                      {d.date} â€” Late log-in ({fmtMins(d.minutes)}).{d.remarks ? ' ' + d.remarks : ''}
                    </div>
                  ))}
                  {s.absentDates.map((d, i) => (
                    <div key={i} className="text-sm text-red-700 flex gap-2">
                      <span className="text-red-400">Â·</span>
                      {d.date} â€” Unauthorised absence.{d.remarks ? ' ' + d.remarks : ''}
                    </div>
                  ))}
                </>
              )}
              {s.auditIssues.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-amber-800 mb-2 uppercase tracking-wide">Management review pending</h4>
                  <div className="space-y-2">
                    {s.auditIssues.map((issue, i) => (
                      <div key={i} className="text-sm text-slate-700">
                        <div className="font-medium text-slate-800">{issue.date} - {issue.category}</div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          Reason: {issue.reason || 'Not specified'}
                          {issue.actionTaken ? ' | Action: ' + issue.actionTaken : ''}
                          {issue.remarks ? ' | Remarks: ' + issue.remarks : ''}
                        </div>
                        <div className="text-xs text-amber-800 mt-1">{issue.auditMeaning}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-slate-400 mt-2">Generate AI reports for detailed analysis.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
 

