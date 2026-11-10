import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage, setStaffSession } from '../shared/api';
import { Logo } from '../shared/Brand';
import type { User } from '../shared/types';
import { Button, ErrorBanner, Field } from '../shared/ui';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token, user } = await api<{ token: string; user: User }>('/auth/login', { body: { email, password }, token: null });
      setStaffSession(token, user);
      navigate(user.role === 'ADMIN' ? '/admin' : '/agent');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Logo className="mb-8 h-14" />
      <div className="w-full max-w-md rounded-3xl border border-slate-200/70 bg-white p-8 shadow-card">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">NRI In-Person Verification</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in for admins and agents</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <ErrorBanner message={error} />
          <Field label="Email">
            <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" busy={busy} className="w-full">Sign in</Button>
        </form>
        <p className="mt-5 text-xs text-slate-500">Customers join from the invitation link they are sent.</p>
      </div>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Research | Trust | Forever</p>
    </div>
  );
}
