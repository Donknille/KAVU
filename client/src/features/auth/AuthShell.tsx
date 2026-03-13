import type { ReactNode } from "react";
import { Link } from "wouter";
import { HardHat } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  banner?: ReactNode;
  footer?: ReactNode;
  asideEyebrow: string;
  asideTitle: string;
  asideDescription: string;
  asideItems: string[];
  cardClassName?: string;
};

export function AuthShell({
  title,
  subtitle,
  children,
  banner,
  footer,
  asideEyebrow,
  asideTitle,
  asideDescription,
  asideItems,
  cardClassName,
}: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.12),_transparent_34%),linear-gradient(to_bottom,_hsl(var(--muted)/0.35),_transparent_35%)]">
      <header className="border-b bg-background/85 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
              <HardHat className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Der Digitale Polier</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Zugang
              </p>
            </div>
          </Link>

          <Link href="/" className="text-sm font-medium text-muted-foreground">
            Startseite
          </Link>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:py-10">
        <section className="hidden rounded-[32px] border bg-slate-950 p-8 text-white shadow-xl lg:block">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
            {asideEyebrow}
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{asideTitle}</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">{asideDescription}</p>

          <div className="mt-8 space-y-3">
            {asideItems.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          {banner}

          <Card className={cn("rounded-[28px] border bg-card/95 p-5 shadow-xl md:p-7", cardClassName)}>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Direkter Zugang
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
              <p className="text-sm leading-6 text-muted-foreground">{subtitle}</p>
            </div>

            <div className="mt-6">{children}</div>
          </Card>

          {footer}
        </section>
      </main>
    </div>
  );
}
