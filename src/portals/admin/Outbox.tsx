import { useState } from 'react';
import { api, errorMessage, useLoad } from '../../shared/api';
import type { Notification } from '../../shared/types';
import { Button, Card, EmptyState, ErrorBanner, formatDateTime, Loading, PageHeader, SuccessBanner } from '../../shared/ui';

export default function Outbox() {
  const { data, error } = useLoad(() => api<{ notifications: Notification[] }>('/admin/notifications'), []);
  const [check, setCheck] = useState<{ ok: boolean; message: string } | null>(null);
  const [checking, setChecking] = useState(false);

  // Signs in to the mail server without sending anything, and shows the result.
  async function checkMail() {
    setChecking(true);
    setCheck(null);
    try {
      setCheck(await api<{ ok: boolean; message: string }>('/admin/mail-check', { method: 'POST' }));
    } catch (err) {
      setCheck({ ok: false, message: errorMessage(err) });
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle="Every message to a customer. Invitations are emailed. Other messages are recorded here only."
        action={<Button variant="secondary" busy={checking} onClick={checkMail}>Check email settings</Button>}
      />
      {check && <div className="mb-4">{check.ok ? <SuccessBanner message={check.message} /> : <ErrorBanner message={check.message} />}</div>}
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
                <p className="text-xs text-slate-500">To {message.recipient} · {message.channel === 'EMAIL' ? (message.status === 'SENT' ? 'Emailed' : 'Email failed') : 'Not sent (recorded only)'}</p>
                <p className="mt-1 text-sm text-slate-700">{message.body}</p>
                {message.error && <p className="mt-1 text-xs text-red-700">{message.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
