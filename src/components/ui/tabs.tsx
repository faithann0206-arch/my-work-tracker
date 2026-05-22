import React, { createContext, useContext, useMemo, useState } from 'react';

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs components must be used inside Tabs');
  return ctx;
}

export function Tabs({
  defaultValue,
  children,
}: {
  defaultValue: string;
  children: React.ReactNode;
}) {
  const [value, setValue] = useState(defaultValue);
  const ctx = useMemo(() => ({ value, setValue }), [value]);

  return <TabsContext.Provider value={ctx}>{children}</TabsContext.Provider>;
}

export function TabsList({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`inline-flex rounded-lg bg-slate-100 p-1 ${className}`} role="tablist">
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  const tabs = useTabs();
  const active = tabs.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => tabs.setValue(value)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  const tabs = useTabs();
  if (tabs.value !== value) return null;
  return <div role="tabpanel">{children}</div>;
}
