import type { ReactNode } from "react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { BrandMark } from "@/components/BrandMark";
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
    <div className="brand-grid-shell min-h-screen">
      <header className="border-b border-[#173d66]/10 bg-white/82 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark
              showWordmark
              subtitle="Zugang"
              size={38}
              labelClassName="text-base"
              subtitleClassName="text-[10px]"
            />
          </Link>

          <Link href="/" className="text-sm font-medium text-[#173d66]/72 transition-colors hover:text-[#173d66]">
            Startseite
          </Link>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:py-10">
        <section className="brand-panel hidden rounded-[34px] p-8 text-[#173d66] lg:block">
          <BrandMark
            showWordmark
            subtitle="Digitale Disposition"
            size={54}
            labelClassName="text-[2rem]"
          />
          <p className="brand-kicker mt-8">
            {asideEyebrow}
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{asideTitle}</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-[#173d66]/72">{asideDescription}</p>

          <div className="mt-8 space-y-3">
            {asideItems.map((item) => (
              <div
                key={item}
                className="brand-soft-card flex items-start gap-3 rounded-2xl px-4 py-3 text-sm text-[#173d66]"
              >
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#68d5c8]" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          {banner}

          <Card className={cn("brand-panel rounded-[30px] p-5 md:p-7", cardClassName)}>
            <div className="space-y-2">
              <p className="brand-kicker">
                Zugang
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
