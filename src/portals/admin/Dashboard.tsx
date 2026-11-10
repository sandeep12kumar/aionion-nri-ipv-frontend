import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api, useLoad } from '../../shared/api';
import type { Application, AuditLog } from '../../shared/types';
import { Button, Card, EmptyState, ErrorBanner, formatDateTime, humanize, Loading, PageHeader, StatCard, StatusBadge } from '../../shared/ui';

interface DashboardData {
  total: number;
  byStatus: Record<string, number>;
  scheduledToday: number;
  liveSessions: number;
  agents: number;
  recentActivity: AuditLog[];
}

export default function Dashboard() {
  const { data, error } = useLoad(async () => {
    const [stats, pending] = await Promise.all([
      api<DashboardData>('/admin/dashboard'),
      api<{ applications: Application[] }>('/applications?status=PENDING_REVIEW'),
    ]);
    return { stats, pending: pending.applications };
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!data) return <Loading />;
  const { stats, pending } = data;
  const count = (status: string) => stats.byStatus[status] ?? 0;
  const closed = count('APPROVED') + count('REJECTED');

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="In-Person Verification across all NRI clients"
        action={<Link to="/admin/applications/new"><Button><Plus className="h-4 w-4" /> New IPV request</Button></Link>}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Requests closed" value={closed} of={stats.total || undefined} />
        <StatCard label="Awaiting KYC review" value={count('PENDING_REVIEW')} />
        <StatCard label="Live sessions now" value={stats.liveSessions} />
        <StatCard label="Scheduled today" value={stats.scheduledToday} />
        <StatCard label="Re-verification needed" value={count('REVERIFICATION')} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Awaiting your review" className="xl:col-span-2">
          {pending.length === 0 ? (
            <EmptyState title="Nothing to review">Submitted verifications will appear here.</EmptyState>
          ) : (
            <div className="-m-5 overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-100"><th className="th">Reference</th><th className="th">Client</th><th className="th">Agent</th><th className="th">Submitted</th><th className="th" /></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {pending.map((app) => (
                    <tr key={app.id}>
                      <td className="td font-medium text-slate-900">{app.reference_no}</td>
                      <td className="td">{app.client_name}</td>
                      <td className="td">{app.agent_name}</td>
                      <td className="td">{formatDateTime(app.session?.ended_at)}</td>
                      <td className="td text-right"><Link className="font-medium text-brand-700 hover:underline" to={`/admin/applications/${app.id}`}>Review</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Requests by status">
          {Object.keys(stats.byStatus).length === 0 ? (
            <EmptyState title="No requests yet" />
          ) : (
            <ul className="space-y-2.5">
              {Object.entries(stats.byStatus).map(([status, value]) => (
                <li key={status} className="flex items-center justify-between">
                  <StatusBadge status={status} />
                  <span className="text-sm font-medium tabular-nums">{value}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">{stats.agents} active agent{stats.agents === 1 ? '' : 's'}</p>
        </Card>

        <Card title="Recent activity" className="xl:col-span-3">
          {stats.recentActivity.length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.recentActivity.map((log) => (
                <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span><span className="font-medium">{log.actor_name}</span> <span className="text-slate-600">{humanize(log.action)}</span></span>
                  <span className="text-xs text-slate-500">{formatDateTime(log.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
