import { api, useLoad } from '../../shared/api';
import type { Notification } from '../../shared/types';
import { Card, EmptyState, ErrorBanner, formatDateTime, Loading, PageHeader } from '../../shared/ui';

export default function Outbox() {
  const { data, error } = useLoad(() => api<{ notifications: Notification[] }>('/admin/notifications'), []);

  return (
    <>
      <PageHeader title="Local outbox" subtitle="Messages the app would send. No email or SMS gateway is connected, so nothing here is delivered." />
      <Card className="[&>div]:p-0">
        {error && <div className="p-4"><ErrorBanner message={error} /></div>}
        {!data && !error && <Loading />}
        {data && data.notifications.length === 0 && <EmptyState title="No messages yet" />}
        {data && data.notifications.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {data.notifications.map((message) => (
              <li key={message.id} className="px-5 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{message.subject}</span>
                  <span className="text-xs text-slate-500">{formatDateTime(message.created_at)}</span>
                </div>
                <p className="text-xs text-slate-500">To {message.recipient}</p>
                <p className="mt-1 text-sm text-slate-700">{message.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
