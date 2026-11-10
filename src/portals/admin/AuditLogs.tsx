import { useState } from 'react';
import { api, useLoad } from '../../shared/api';
import type { AuditLog } from '../../shared/types';
import { Card, EmptyState, ErrorBanner, formatDateTime, humanize, Loading, PageHeader } from '../../shared/ui';

export default function AuditLogs() {
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const { data, error } = useLoad(
    () => api<{ logs: AuditLog[]; actions: string[] }>(`/admin/audit-logs?action=${action}&search=${encodeURIComponent(search)}`),
    [action, search],
  );

  return (
    <>
      <PageHeader title="Audit logs" subtitle="Who did what, and when. Showing the latest 500 matching entries." />
      <Card className="[&>div]:p-0">
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <input className="input min-w-[220px] flex-1" aria-label="Search logs" placeholder="Search by person or action" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input w-auto" aria-label="Filter by action" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All actions</option>
            {data?.actions.map((a) => <option key={a} value={a}>{humanize(a)}</option>)}
          </select>
        </div>
        {error && <div className="p-4"><ErrorBanner message={error} /></div>}
        {!data && !error && <Loading />}
        {data && data.logs.length === 0 && <EmptyState title="No entries match" />}
        {data && data.logs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-slate-100"><th className="th">Time</th><th className="th">Person</th><th className="th">Action</th><th className="th">Record</th><th className="th">Details</th><th className="th">IP</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.logs.map((log) => (
                  <tr key={log.id}>
                    <td className="td whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                    <td className="td whitespace-nowrap">{log.actor_name} <span className="text-xs text-slate-400">{log.actor_role}</span></td>
                    <td className="td whitespace-nowrap">{humanize(log.action)}</td>
                    <td className="td whitespace-nowrap">{humanize(log.entity_type)}</td>
                    <td className="td max-w-xs truncate font-mono text-xs" title={JSON.stringify(log.details)}>{JSON.stringify(log.details)}</td>
                    <td className="td whitespace-nowrap text-xs">{log.ip_address}</td>
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
