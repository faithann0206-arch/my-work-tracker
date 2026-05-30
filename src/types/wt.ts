// ─── Pending Items ────────────────────────────────────────────────────────────

export type AbsenceStatus =
  | 'No action'
  | 'Converted to leave'
  | 'Report submitted'
  | 'Resolved';

export type LeaveItemStatus =
  | 'Pending approval'
  | 'Approved'
  | 'Rejected'
  | 'Resolved';

export type LeaveLetterStatus =
  | 'Letter received'
  | 'Pending mgt approval'
  | 'Approved';

export interface WtPendingItem {
  id: string;
  ref: string;
  type: 'absence' | 'leave';
  description: string;
  dates: string;
  status: string;
  officialLetterStatus?: LeaveLetterStatus;
  notes: string;
  createdAt: string;
}

// ─── Official Letters ─────────────────────────────────────────────────────────

export type LetterStatus =
  | 'Required'
  | 'Requested'
  | 'Yet to be discussed'
  | 'Issued'
  | 'Not required';

export interface WtOfficialLetter {
  id: string;
  ref: string;
  relatesTo: string;
  employeeNo?: string;
  leaveDays?: string;
  leaveType?: string;
  dateAdded: string;
  status: LetterStatus;
  notes: string;
  notRequiredWhy: string;
  notRequiredWhoInstructed: string;
  notRequiredSource: string;
  createdAt: string;
}

// ─── Email Log ────────────────────────────────────────────────────────────────

export type EmailCategory =
  | 'Attendance'
  | 'Leave'
  | 'Absence'
  | 'Official letter'
  | 'Policy instruction'
  | 'Other';

export type EmailDirection =
  | 'Received from management'
  | 'Sent to management';

export interface WtEmail {
  id: string;
  date: string;
  direction: EmailDirection;
  subject: string;
  category: EmailCategory;
  body: string;
  createdAt: string;
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export interface WtAttendanceRow {
  date: string;
  dayName: string;
  timeIn: string;
  timeOut: string;
  totalHours: string;
  thresholdTime: string;
  expectedOut: string;
  minutesLate: number;
  earlyLeaveMinutes: number;
  ptUsed: number;
  ptAllowance: number;
  ptRemaining: number;
  arabicReason: string;
  actionTaken: string;
  remarks: string;
}

export interface WtLateDateEntry {
  date: string;
  minutes: number;
  remarks: string;
  actionTaken: string;
}

export interface WtAbsentDateEntry {
  date: string;
  remarks: string;
  actionTaken: string;
}

export interface WtLeaveDateEntry {
  type: string;
  date: string;
  remarks?: string;
  actionTaken?: string;
}

export interface WtEarlyLeaveEntry {
  date: string;
  minutes: number;
  balanceBefore: number;
  balanceAfter: number;
  remarks: string;
  actionTaken: string;
}

export interface WtAuditIssueEntry {
  date: string;
  category: string;
  reason: string;
  actionTaken: string;
  remarks: string;
  auditMeaning: string;
}

export interface WtAttendanceSummary {
  lateInstances: number;
  totalLateMinutes: number;
  ptUsed: number;
  ptBalance: number;
  totalAllowanceUsed: number;
  allowanceRemaining: number;
  ptExceeded: boolean;
  ptExceedByMinutes: number;
  earlyLeaveCount: number;
  totalEarlyLeaveMinutes: number;
  missionCount: number;
  remoteWorkCount: number;
  absentCount: number;
  missingPunchCount: number;
  lateDates: WtLateDateEntry[];
  earlyLeaveDates: WtEarlyLeaveEntry[];
  absentDates: WtAbsentDateEntry[];
  leaveDates: WtLeaveDateEntry[];
  auditIssues: WtAuditIssueEntry[];
  status: 'Compliant' | 'Flagged';
}

export interface WtEmployeeReport {
  bullets: string[];
  summary: string;
  generatedAt: string;
}

export interface WtAttendanceEmployee {
  sheetName: string;
  employeeName: string;
  rows: WtAttendanceRow[];
  summary: WtAttendanceSummary;
  report?: WtEmployeeReport;
}

// ─── Policy Notes ─────────────────────────────────────────────────────────────

export interface WtPolicyNote {
  id: string;
  url: string;
  title: string;
  analysis: string;
  savedAt: string;
  isManual: boolean;
}
 
