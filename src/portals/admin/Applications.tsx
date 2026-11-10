import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { api, useLoad } from '../../shared/api';
import type { Application } from '../../shared/types';
import { Button, Card, EmptyState, ErrorBanner, formatDateTime, humanize, Loading, PageHeader, StatusBadge } from '../../shared/ui';

const STATUSES = ['DRAFT', 'ASSIGNED', 'SCHEDULED', 'INVITED', 'IN_PROGRESS', 'SESSION_DROPPED', 'PENDING_REVIEW', 'REVERIFICATION', 'APPROVED', 'REJECTED'];

export default function Applications() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const { data, error } = useLoad(
    () => api<{ applications: Application[] }>(`/applications?status=${status}&search=${encodeURIComponent(search)}`),
    [status, search],
  );

  return (
    <>
      <PageHeader
        title="IPV requests"
        subtitle="Search NRI clients and track each request"
        action={<Link to="/admin/applications/new"><Button><Plus className="h-4 w-4" /> New IPV request</Button></Link>}
      />
      <Card className="overflow-hidden [&>div]:p-0">
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search name, reference, email, passport or PAN"
              aria-label="Search requests"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="input w-auto" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
        </div>
        {error && <div className="p-4"><ErrorBanner message={error} /></div>}
        {!data && !error && <Loading />}
        {data && data.applications.length === 0 && (
          <EmptyState title="No requests match">Try a different search or create a new request.</EmptyState>
        )}
        {data && data.applications.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="th">Reference</th><th className="th">Client</th><th className="th">Residence</th><th className="th">Agent</th>
                  <th className="th">Meeting</th><th className="th">Documents</th><th className="th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.applications.map((app) => (
                  <tr key={app.id} onClick={() => navigate(`/admin/applications/${app.id}`)} className="cursor-pointer hover:bg-slate-50">
                    <td className="td font-medium">
                      <Link to={`/admin/applications/${app.id}`} className="text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>{app.reference_no}</Link>
                    </td>
                    <td className="td"><div className="font-medium text-slate-900">{app.client_name}</div><div className="text-xs text-slate-500">{app.email}</div></td>
                    <td className="td">{app.country_of_residence}</td>
                    <td className="td">{app.agent_name ?? <span className="text-slate-400">Unassigned</span>}</td>
                    <td className="td whitespace-nowrap">{formatDateTime(app.session?.scheduled_at)}</td>
                    <td className="td tabular-nums">{app.documents_captured}/{app.documents_required}</td>
                    <td className="td"><StatusBadge status={app.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
