import type { ReactNode } from "react";

type SessionStatePanelProps = {
  title: string;
  description: string;
  actions?: ReactNode;
};

export function SessionStatePanel({
  title,
  description,
  actions,
}: SessionStatePanelProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="brand-panel w-full max-w-md rounded-3xl p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] brand-ink-muted">
          Meisterplaner
        </p>
        <h1 className="mt-3 text-2xl font-semibold brand-ink">{title}</h1>
        <p className="mt-3 text-sm leading-6 brand-ink-soft">{description}</p>
        {actions ? <div className="mt-6 flex gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
