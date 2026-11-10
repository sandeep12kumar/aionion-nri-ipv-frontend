// Aionion Capital logo files live in frontend/public.
export function Logo({ className = 'h-11' }: { className?: string }) {
  return <img src="/aionion-logo.png" alt="Aionion Capital" className={`w-auto ${className}`} />;
}

export function LogoMark({ className = 'h-8' }: { className?: string }) {
  return <img src="/aionion-mark.png" alt="Aionion Capital" className={`w-auto ${className}`} />;
}

// The product name shown opposite the logo, like "PRE KYC" on the onboarding screens.
export function ProductTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="text-right">
      <div className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">{title}</div>
      {subtitle && <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">{subtitle}</div>}
    </div>
  );
}
