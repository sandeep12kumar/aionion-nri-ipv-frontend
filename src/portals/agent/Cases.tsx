import { Link } from 'react-router-dom';
import { Video } from 'lucide-react';
import { api, useLoad } from '../../shared/api';
import type { Application } from '../../shared/types';
import { Button, Card, EmptyState, ErrorBanner, formatDateTime, Loading, PageHeader, StatCard, StatusBadge } from '../../shared/ui';

const JOINABLE = ['SCHEDULED', 'INVITED', 'CUSTOMER_READY', 'LIVE'];

export default function Cases() {
  const { data, error } = useLoad(() => api<{ applications: Application[] }>('/applications'), []);
  const cases = data?.applications ?? [];
  const active = cases.filter((c) => c.session && JOINABLE.includes(c.session.status));
  const awaiting = cases.filter((c) => c.status === 'PENDING_REVIEW');

  return (
    <>
      <PageHeader title="My cases" subtitle="IPV requests assigned to you" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Assigned to you" value={cases.length} />
        <StatCard label="Ready for a session" value={active.length} />
        <StatCard label="Submitted, awaiting review" value={awaiting.length} />
      </div>
      <Card className="[&>div]:p-0">
        {error && <div className="p-4"><ErrorBanner message={error} /></div>}
        {!data && !error && <Loading />}
        {data && cases.length === 0 && <EmptyState title="No cases assigned">An admin will assign requests to you.</EmptyState>}
        {cases.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-slate-100"><th className="th">Reference</th><th className="th">Client</th><th className="th">Meeting</th><th className="th">Customer</th><th className="th">Status</th><th className="th" /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {cases.map((item) => {
                  const joinable = item.session && JOINABLE.includes(item.session.status);
                  return (
                    <tr key={item.id}>
                      <td className="td font-medium text-slate-900">{item.reference_no}</td>
                      <td className="td"><div className="font-medium text-slate-900">{item.client_name}</div><div className="text-xs text-slate-500">{item.country_of_residence}</div></td>
                      <td className="td whitespace-nowrap">{formatDateTime(item.session?.scheduled_at)}</td>
                      <td className="td">{item.session?.device_checked_at ? <StatusBadge status="VERIFIED" label="Ready to join" /> : <span className="text-xs text-slate-500">Not ready yet</span>}</td>
                      <td className="td"><StatusBadge status={item.status} /></td>
                      <td className="td text-right">
                        {joinable ? (
                          <Link to={`/agent/session/${item.session!.id}`}><Button small><Video className="h-3.5 w-3.5" /> {item.session!.status === 'LIVE' ? 'Rejoin session' : 'Start session'}</Button></Link>
                        ) : <span className="text-xs text-slate-400">{item.status === 'ASSIGNED' ? 'Waiting for a meeting time' : 'No session open'}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
