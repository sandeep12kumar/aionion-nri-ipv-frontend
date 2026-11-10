import { useState, type FormEvent } from 'react';
import { api, errorMessage, getStaffUser, useLoad } from '../../shared/api';
import type { User } from '../../shared/types';
import { Button, Card, ErrorBanner, Field, humanize, Loading, PageHeader, StatusBadge, SuccessBanner } from '../../shared/ui';

const BLANK = { name: '', email: '', role: 'AGENT', password: '' };

export default function Users() {
  const { data, error, reload } = useLoad(() => api<{ users: User[] }>('/users'), []);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const me = getStaffUser();

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    setNotice(null);
    try {
      await api('/users', { body: form });
      setNotice(`${form.name} was added.`);
      setForm(BLANK);
      await reload();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function update(user: User, body: Record<string, unknown>, message: string) {
    setFormError(null);
    setNotice(null);
    try {
      await api(`/users/${user.id}`, { method: 'PATCH', body });
      setNotice(message);
      await reload();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  }

  function resetPassword(user: User) {
    const password = window.prompt(`New password for ${user.name} (at least 8 characters)`);
    if (password) void update(user, { password }, `Password updated for ${user.name}.`);
  }

  return (
    <>
      <PageHeader title="Users and agents" subtitle="Manage who can sign in" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="[&>div]:p-0">
          {error && <div className="p-4"><ErrorBanner message={error} /></div>}
          {!data && !error && <Loading />}
          {data && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-100"><th className="th">Name</th><th className="th">Role</th><th className="th">Open cases</th><th className="th">Status</th><th className="th" /></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.users.map((user) => (
                    <tr key={user.id}>
                      <td className="td"><div className="font-medium text-slate-900">{user.name}</div><div className="text-xs text-slate-500">{user.email}</div></td>
                      <td className="td">{humanize(user.role)}</td>
                      <td className="td tabular-nums">{user.active_cases}</td>
                      <td className="td"><StatusBadge status={user.active ? 'VERIFIED' : 'DROPPED'} label={user.active ? 'Active' : 'Inactive'} /></td>
                      <td className="td whitespace-nowrap text-right">
                        <Button small variant="ghost" onClick={() => resetPassword(user)}>Reset password</Button>
                        {user.id !== me?.id && (
                          <Button small variant="ghost" onClick={() => update(user, { active: !user.active }, `${user.name} is now ${user.active ? 'inactive' : 'active'}.`)}>
                            {user.active ? 'Deactivate' : 'Activate'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Add a user">
          <form onSubmit={create} className="space-y-3">
            <ErrorBanner message={formError} />
            <SuccessBanner message={notice} />
            <Field label="Full name"><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Email"><input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Role">
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="AGENT">Agent</option>
                <option value="ADMIN">Admin</option>
              </select>
            </Field>
            <Field label="Password" hint="At least 8 characters">
              <input className="input" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <Button type="submit" busy={busy} className="w-full">Add user</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
