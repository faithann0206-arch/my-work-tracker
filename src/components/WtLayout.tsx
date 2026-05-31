import { useState } from 'react';
import type React from 'react';
import { Link, useRoute } from 'wouter';
import {
  LayoutDashboard, ClipboardList, FileText, Mail,
  CalendarDays, BookOpen, Menu, ChevronRight, Briefcase, LogOut,
} from 'lucide-react';

type NavItem = { path: string; label: string; icon: React.ElementType };

const NAV_ITEMS: NavItem[] = [
  { path: '/',           label: 'Dashboard',       icon: LayoutDashboard },
  { path: '/pending',    label: 'Pending Items',   icon: ClipboardList },
  { path: '/letters',    label: 'Official Letters', icon: FileText },
  { path: '/emails',     label: 'Email Log',       icon: Mail },
  { path: '/attendance', label: 'Attendance',      icon: CalendarDays },
  { path: '/policy',     label: 'Policy Reader',   icon: BookOpen },
];

function NavLink({ path, label, icon: Icon, collapsed }: NavItem & { collapsed: boolean }) {
  const [isActive] = useRoute(path === '/' ? '/' : path + '*');
  return (
    <Link href={path}>
      <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 mx-2 mb-0.5 ${
        isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
      }`}>
        <Icon size={17} className="shrink-0" />
        {!collapsed && <span className="text-sm font-medium truncate">{label}</span>}
      </div>
    </Link>
  );
}

export default function WtLayout({ children, onLogout }: { children: React.ReactNode; onLogout?: () => void }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className={`flex flex-col bg-slate-800 transition-all duration-200 shrink-0 ${collapsed ? 'w-14' : 'w-60'}`}>
        <div className={`flex items-center gap-2 px-4 py-5 border-b border-slate-700 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <Briefcase size={15} className="text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-white font-bold text-sm leading-tight">My Work Tracker</div>
              <div className="text-slate-400 text-xs">Personal HR Reminders</div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {NAV_ITEMS.map(item => (
            <NavLink key={item.path} {...item} collapsed={collapsed} />
          ))}
        </nav>

        <div className="border-t border-slate-700">
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 p-3 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              title="Log out"
            >
              <LogOut size={16} />
              {!collapsed && <span className="text-xs font-medium">Log out</span>}
            </button>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-full flex items-center justify-center p-3 border-t border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            {collapsed ? <ChevronRight size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
 
