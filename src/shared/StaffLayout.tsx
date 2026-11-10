import type { ReactNode } from 'react';
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Briefcase, FileText, History, LayoutDashboard, LogOut, Mail, Users } from 'lucide-react';
import { clearStaffSession, getStaffUser } from './api';
import { Logo, ProductTitle } from './Brand';
import type { Role } from './types';

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const user = getStaffUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/applications', label: 'IPV requests', icon: FileText },
  { to: '/admin/users', label: 'Users and agents', icon: Users },
  { to: '/admin/audit', label: 'Audit logs', icon: History },
  { to: '/admin/outbox', label: 'Local outbox', icon: Mail },
];

const AGENT_NAV = [{ to: '/agent', label: 'My cases', icon: Briefcase, end: true }];

export default function StaffLayout() {
  const navigate = useNavigate();
  const user = getStaffUser()!;
  const nav = user.role === 'ADMIN' ? ADMIN_NAV : AGENT_NAV;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200/70 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <Logo className="h-10 md:h-12" />
          <ProductTitle title="NRI IPV" subtitle={user.role === 'ADMIN' ? 'Admin portal' : 'Agent portal'} />
        </div>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 pb-4 md:px-8">
          <nav className="flex gap-2 overflow-x-auto" aria-label="Main">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `pill ${isActive ? 'pill-active' : 'pill-idle hover:bg-slate-200'}`}>
                <Icon className="h-3.5 w-3.5" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-semibold text-slate-800">{user.name}</div>
              <div className="text-xs text-slate-500">{user.email}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                clearStaffSession();
                navigate('/login');
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto min-w-0 max-w-7xl p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
