import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, ImageOff, Loader2 } from 'lucide-react';
import { apiBlob } from './api';

export const formatDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export const humanize = (value: string) =>
  value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
    .replace(/\b(kyc|ocr|otp|pan)\b/gi, (word) => word.toUpperCase());

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white shadow-button hover:bg-brand-700',
  secondary: 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
  danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  busy?: boolean;
  small?: boolean;
}

export function Button({ variant = 'primary', busy, small, className = '', children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${small ? 'px-2.5 py-1.5 text-xs' : 'px-5 py-2.5 text-sm'} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200/70 bg-white shadow-card ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

const TONES: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  blue: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  orange: 'bg-orange-50 text-orange-700 ring-orange-600/20',
};

const STATUS_TONE: Record<string, string> = {
  DRAFT: 'slate', ASSIGNED: 'blue', SCHEDULED: 'blue', INVITED: 'blue', IN_PROGRESS: 'orange',
  PENDING_REVIEW: 'amber', APPROVED: 'green', REJECTED: 'red', REVERIFICATION: 'amber', SESSION_DROPPED: 'red',
  CUSTOMER_READY: 'blue', LIVE: 'orange', COMPLETED: 'green', DROPPED: 'red',
  PENDING: 'slate', CAPTURED: 'blue', OCR_DONE: 'blue', VERIFIED: 'green', STORED: 'slate',
  NO_FIELDS_FOUND: 'amber',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = TONES[STATUS_TONE[status] ?? 'slate'];
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}>
      {label ?? humanize(status)}
    </span>
  );
}

export function ErrorBanner({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function SuccessBanner({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, of, hint }: { label: string; value: number | string; of?: number; hint?: string }) {
  const percent = of ? Math.min(100, Math.round((Number(value) / of) * 100)) : null;
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums text-slate-900">
          {value}
          {of !== undefined && <span className="text-base font-normal text-slate-400">/{of}</span>}
        </span>
      </div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      {percent !== null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${percent}%` }} />
        </div>
      )}
      {hint && <div className="mt-2 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function KeyValues({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="space-y-2.5">
      {rows.map(([key, value]) => (
        <div key={key}>
          <dt className="text-xs text-slate-500">{key}</dt>
          <dd className="break-words text-sm text-slate-900">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

// Files need the sign-in token, so they are fetched and shown through a temporary URL.
export function ProtectedImage({ path, alt, className = '' }: { path: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;
    setFailed(false);
    apiBlob(path)
      .then((blob) => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setFailed(true));
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className}`}>
        <ImageOff className="h-5 w-5" aria-label="Image could not be loaded" />
      </div>
    );
  }
  if (!url) return <div className={`animate-pulse bg-slate-100 ${className}`} />;
  return <img src={url} alt={alt} className={className} />;
}
