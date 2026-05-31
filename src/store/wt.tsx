import React, { createContext, useContext, useState, useCallback } from 'react';
import type {
  WtPendingItem, WtOfficialLetter, WtEmail,
  WtAttendanceEmployee, WtPolicyNote, WtMonthlyWorkItem,
} from '../types/wt';

function wtLoad<T>(key: string, def: T): T {
  try {
    const raw = localStorage.getItem('wt_' + key);
    return raw ? (JSON.parse(raw) as T) : def;
  } catch { return def; }
}

function wtSave<T>(key: string, val: T) {
  try { localStorage.setItem('wt_' + key, JSON.stringify(val)); } catch {}
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

interface WtState {
  pending: WtPendingItem[];
  letters: WtOfficialLetter[];
  emails: WtEmail[];
  monthlyWork: WtMonthlyWorkItem[];
  attEmployees: Record<string, WtAttendanceEmployee>;
  policyNotes: WtPolicyNote[];
  apiKey: string;
}

interface WtContextValue extends WtState {
  addPending: (item: Omit<WtPendingItem, 'id' | 'createdAt'>) => void;
  updatePending: (id: string, patch: Partial<WtPendingItem>) => void;
  deletePending: (id: string) => void;
  addLetter: (l: Omit<WtOfficialLetter, 'id' | 'createdAt'>) => void;
  updateLetter: (id: string, patch: Partial<WtOfficialLetter>) => void;
  deleteLetter: (id: string) => void;
  addEmail: (e: Omit<WtEmail, 'id' | 'createdAt'>) => void;
  deleteEmail: (id: string) => void;
  addMonthlyWork: (item: Omit<WtMonthlyWorkItem, 'id' | 'createdAt'>) => void;
  updateMonthlyWork: (id: string, patch: Partial<WtMonthlyWorkItem>) => void;
  deleteMonthlyWork: (id: string) => void;
  setAttEmployees: (emps: Record<string, WtAttendanceEmployee>) => void;
  updateAttEmployee: (sheetName: string, patch: Partial<WtAttendanceEmployee>) => void;
  clearAttendance: () => void;
  addPolicyNote: (n: Omit<WtPolicyNote, 'id' | 'savedAt'>) => void;
  deletePolicyNote: (id: string) => void;
  setApiKey: (key: string) => void;
}

const WtContext = createContext<WtContextValue | null>(null);

export function WtProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WtState>(() => ({
    pending: wtLoad<WtPendingItem[]>('pending', []),
    letters: wtLoad<WtOfficialLetter[]>('letters', []),
    emails: wtLoad<WtEmail[]>('emails', []),
    monthlyWork: wtLoad<WtMonthlyWorkItem[]>('monthlyWork', []),
    attEmployees: wtLoad<Record<string, WtAttendanceEmployee>>('attEmployees', {}),
    policyNotes: wtLoad<WtPolicyNote[]>('policyNotes', []),
    apiKey: wtLoad<string>('apiKey', ''),
  }));

  const addPending = useCallback((item: Omit<WtPendingItem, 'id' | 'createdAt'>) => {
    setState(prev => {
      const next = [...prev.pending, { ...item, id: genId(), createdAt: new Date().toISOString() }];
      wtSave('pending', next);
      return { ...prev, pending: next };
    });
  }, []);

  const updatePending = useCallback((id: string, patch: Partial<WtPendingItem>) => {
    setState(prev => {
      const next = prev.pending.map(p => p.id === id ? { ...p, ...patch } : p);
      wtSave('pending', next);
      return { ...prev, pending: next };
    });
  }, []);

  const deletePending = useCallback((id: string) => {
    setState(prev => {
      const next = prev.pending.filter(p => p.id !== id);
      wtSave('pending', next);
      return { ...prev, pending: next };
    });
  }, []);

  const addLetter = useCallback((l: Omit<WtOfficialLetter, 'id' | 'createdAt'>) => {
    setState(prev => {
      const next = [...prev.letters, { ...l, id: genId(), createdAt: new Date().toISOString() }];
      wtSave('letters', next);
      return { ...prev, letters: next };
    });
  }, []);

  const updateLetter = useCallback((id: string, patch: Partial<WtOfficialLetter>) => {
    setState(prev => {
      const next = prev.letters.map(l => l.id === id ? { ...l, ...patch } : l);
      wtSave('letters', next);
      return { ...prev, letters: next };
    });
  }, []);

  const deleteLetter = useCallback((id: string) => {
    setState(prev => {
      const next = prev.letters.filter(l => l.id !== id);
      wtSave('letters', next);
      return { ...prev, letters: next };
    });
  }, []);

  const addEmail = useCallback((e: Omit<WtEmail, 'id' | 'createdAt'>) => {
    setState(prev => {
      const next = [...prev.emails, { ...e, id: genId(), createdAt: new Date().toISOString() }];
      wtSave('emails', next);
      return { ...prev, emails: next };
    });
  }, []);

  const deleteEmail = useCallback((id: string) => {
    setState(prev => {
      const next = prev.emails.filter(e => e.id !== id);
      wtSave('emails', next);
      return { ...prev, emails: next };
    });
  }, []);

  const addMonthlyWork = useCallback((item: Omit<WtMonthlyWorkItem, 'id' | 'createdAt'>) => {
    setState(prev => {
      const next = [...prev.monthlyWork, { ...item, id: genId(), createdAt: new Date().toISOString() }];
      wtSave('monthlyWork', next);
      return { ...prev, monthlyWork: next };
    });
  }, []);

  const updateMonthlyWork = useCallback((id: string, patch: Partial<WtMonthlyWorkItem>) => {
    setState(prev => {
      const next = prev.monthlyWork.map(item => item.id === id ? { ...item, ...patch } : item);
      wtSave('monthlyWork', next);
      return { ...prev, monthlyWork: next };
    });
  }, []);

  const deleteMonthlyWork = useCallback((id: string) => {
    setState(prev => {
      const next = prev.monthlyWork.filter(item => item.id !== id);
      wtSave('monthlyWork', next);
      return { ...prev, monthlyWork: next };
    });
  }, []);

  const setAttEmployees = useCallback((emps: Record<string, WtAttendanceEmployee>) => {
    wtSave('attEmployees', emps);
    setState(prev => ({ ...prev, attEmployees: emps }));
  }, []);

  const updateAttEmployee = useCallback((sheetName: string, patch: Partial<WtAttendanceEmployee>) => {
    setState(prev => {
      const next = {
        ...prev.attEmployees,
        [sheetName]: { ...prev.attEmployees[sheetName], ...patch },
      };
      wtSave('attEmployees', next);
      return { ...prev, attEmployees: next };
    });
  }, []);

  const clearAttendance = useCallback(() => {
    wtSave('attEmployees', {});
    setState(prev => ({ ...prev, attEmployees: {} }));
  }, []);

  const addPolicyNote = useCallback((n: Omit<WtPolicyNote, 'id' | 'savedAt'>) => {
    setState(prev => {
      const next = [...prev.policyNotes, { ...n, id: genId(), savedAt: new Date().toISOString() }];
      wtSave('policyNotes', next);
      return { ...prev, policyNotes: next };
    });
  }, []);

  const deletePolicyNote = useCallback((id: string) => {
    setState(prev => {
      const next = prev.policyNotes.filter(n => n.id !== id);
      wtSave('policyNotes', next);
      return { ...prev, policyNotes: next };
    });
  }, []);

  const setApiKey = useCallback((key: string) => {
    wtSave('apiKey', key);
    setState(prev => ({ ...prev, apiKey: key }));
  }, []);

  return (
    <WtContext.Provider value={{
      ...state,
      addPending, updatePending, deletePending,
      addLetter, updateLetter, deleteLetter,
      addEmail, deleteEmail,
      addMonthlyWork, updateMonthlyWork, deleteMonthlyWork,
      setAttEmployees, updateAttEmployee, clearAttendance,
      addPolicyNote, deletePolicyNote,
      setApiKey,
    }}>
      {children}
    </WtContext.Provider>
  );
}

export function useWt() {
  const ctx = useContext(WtContext);
  if (!ctx) throw new Error('useWt must be used within WtProvider');
  return ctx;
}
 
