import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BrandMark } from "@/components/BrandMark";
import {
  getInviteToken,
  getInvitationRoleLabel,
  withInviteToken,
} from "@/features/invitations/shared";
import { useInvitationPreview } from "@/features/invitations/useInvitationPreview";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ArrowRight,
  ClipboardCheck,
  Clock,
  KeyRound,
  Mail,
  Shield,
  UserRoundPlus,
} from "lucide-react";

export default function LandingPage() {
  const inviteToken = getInviteToken();
  const { data: invitation, error: invitationError } = useInvitationPreview(inviteToken);
  const isMobile = useIsMobile();
  const adminLoginHref = withInviteToken("/login/admin", inviteToken);
  const adminRegisterHref = withInviteToken("/register/admin", inviteToken);

  const title = invitation
    ? `Einladung von ${invitation.companyName}`
    : "Einsatzplanung und mobile Zeiterfassung fuer Handwerksbetriebe";
  const subtitle = invitation
    ? `${invitation.firstName} ${invitation.lastName} soll als ${getInvitationRoleLabel(invitation.role)} beitreten.`
    : "Meisterplaner verbindet Disposition, Tagesplanung und mobilen Mitarbeitereinsatz in einer klaren Arbeitsoberflaeche.";

  return (
    <div className="brand-grid-shell flex min-h-screen flex-col">
      <header className="border-b border-[#173d66]/10 bg-white/82 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <BrandMark
            showWordmark
            subtitle="Digitale Einsatzplanung"
            size={42}
            labelClassName="text-lg"
            subtitleClassName="text-[10px]"
          />

          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline" className="border-[#173d66]/12 bg-white/80">
              <Link href={adminLoginHref} data-testid="button-login-header">
                Admin
              </Link>
            </Button>
            <Button asChild size="sm" className="bg-[#173d66] text-white hover:bg-[#123251]">
              <Link href="/login/employee" data-testid="button-employee-header">
                Mitarbeiter
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="px-4 py-10 md:py-16">
          <div className="mx-auto max-w-6xl">
            {inviteToken && invitation && (
              <Card className="brand-panel mx-auto mb-6 max-w-3xl rounded-[28px] p-5 text-left">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#173d66]/8 text-[#173d66]">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[#173d66]">Einladung erkannt</p>
                    <p className="text-sm text-[#173d66]/72">
                      {invitation.companyName} hat {invitation.email} eingeladen.
                    </p>
                    <p className="text-sm text-[#173d66]/72">
                      Melde dich an oder erstelle ein Konto mit dieser E-Mail-Adresse.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {inviteToken && invitationError && (
              <Card className="mx-auto mb-6 max-w-3xl rounded-[28px] border-destructive/20 bg-destructive/5 p-5 text-left">
                <p className="text-sm font-semibold text-destructive">
                  Der Einladungslink ist ungueltig oder abgelaufen.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Du kannst dich trotzdem anmelden oder einen eigenen Betrieb registrieren.
                </p>
              </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
              <section className="brand-panel rounded-[36px] p-6 md:p-8">
                <p className="brand-kicker">Fuer Inhaber, Buero und Baustelle</p>
                <h1
                  className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-[#173d66] md:text-6xl"
                  data-testid="text-hero-title"
                >
                  {title}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-[#173d66]/72 md:text-lg">
                  {subtitle}
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <span className="brand-highlight rounded-full px-4 py-2 text-sm font-medium">
                    Planung und Tagessteuerung in einer Ansicht
                  </span>
                  <span className="brand-highlight rounded-full px-4 py-2 text-sm font-medium">
                    Mobile Zeiterfassung fuer Mitarbeitende
                  </span>
                  <span className="brand-highlight rounded-full px-4 py-2 text-sm font-medium">
                    Sichere Zugangsmodelle fuer Admin und Team
                  </span>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <div className="brand-soft-card rounded-[24px] p-4">
                    <p className="brand-kicker">Disposition</p>
                    <p className="mt-2 text-sm leading-6 text-[#173d66]/72">
                      Auftraege, Teams und freie Kapazitaeten im laufenden Tagesgeschaeft.
                    </p>
                  </div>
                  <div className="brand-soft-card rounded-[24px] p-4">
                    <p className="brand-kicker">Mitarbeiterzugang</p>
                    <p className="mt-2 text-sm leading-6 text-[#173d66]/72">
                      Auch ohne persoenliche E-Mail direkt einsetzbar.
                    </p>
                  </div>
                  <div className="brand-soft-card rounded-[24px] p-4">
                    <p className="brand-kicker">Nachweise</p>
                    <p className="mt-2 text-sm leading-6 text-[#173d66]/72">
                      Zeiten und Statusmeldungen werden mobil und nachvollziehbar erfasst.
                    </p>
                  </div>
                </div>
              </section>

              <div className="grid gap-4">
                <Card className="brand-panel rounded-[30px] p-5 md:p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#173d66]/8 text-[#173d66]">
                    <UserRoundPlus className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold text-[#173d66]">Betrieb verwalten</h2>
                  <p className="mt-2 text-sm leading-6 text-[#173d66]/72">
                    Fuer Inhaber, Buero und Disposition. Anmeldung und Registrierung erfolgen in einem eigenen, klaren Bereich.
                  </p>
                  <div className="mt-6 grid gap-2 sm:grid-cols-2">
                    <Button asChild className="h-12 bg-[#173d66] text-base text-white hover:bg-[#123251]" data-testid="button-admin-login-primary">
                      <Link href={adminLoginHref}>
                        {inviteToken ? "Mit E-Mail anmelden" : "Admin anmelden"}
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="h-12 border-[#173d66]/14 bg-white/80 text-base text-[#173d66]"
                      data-testid="button-admin-register-primary"
                    >
                      <Link href={adminRegisterHref}>
                        {inviteToken ? "Konto erstellen" : "Betrieb registrieren"}
                      </Link>
                    </Button>
                  </div>
                  <p className="mt-4 text-xs text-[#173d66]/58">
                    Anmeldung mit E-Mail-Adresse und Passwort.
                  </p>
                </Card>

                <Card className="brand-panel rounded-[30px] p-5 md:p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#68d5c8]/26 text-[#173d66]">
                    <Shield className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold text-[#173d66]">Mitarbeiter anmelden</h2>
                  <p className="mt-2 text-sm leading-6 text-[#173d66]/72">
                    Fuer operative Teams ohne persoenliche E-Mail-Adresse. Anmeldung mit Betriebscode, Benutzername und Passwort.
                  </p>
                  <div className="mt-6">
                    <Button
                      asChild
                      variant="outline"
                      className="h-12 w-full justify-between border-[#173d66]/14 bg-white/80 text-base text-[#173d66]"
                      data-testid="button-employee-login-hero"
                    >
                      <Link href="/login/employee">
                        Mitarbeiterzugang
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                  <p className="mt-4 text-xs text-[#173d66]/58">
                    Zugangsdaten koennen intern sicher weitergegeben oder ausgedruckt werden.
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 md:pb-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="brand-kicker">Meisterplaner im Einsatz</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#173d66]">
                  {isMobile ? "Fuer den mobilen Einsatz optimiert" : "Die wichtigsten Funktionen im Ueberblick"}
                </h2>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="brand-soft-card rounded-[28px] p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#173d66]/8 text-[#173d66]">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-[#173d66]">Wer ist heute wo?</h3>
                <p className="mt-2 text-sm leading-6 text-[#173d66]/72">
                  Auftraege, Teams und Einsatztage in einer klaren Dispositionsansicht.
                </p>
              </Card>

              <Card className="brand-soft-card rounded-[28px] p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#68d5c8]/26 text-[#173d66]">
                  <Clock className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-[#173d66]">Was ist der Status?</h3>
                <p className="mt-2 text-sm leading-6 text-[#173d66]/72">
                  Arbeitszeit, Pause und Abschluss werden mobil sauber und schnell erfasst.
                </p>
              </Card>

              <Card className="brand-soft-card rounded-[28px] p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#173d66]/8 text-[#173d66]">
                  <KeyRound className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-[#173d66]">Passende Zugangsmodelle</h3>
                <p className="mt-2 text-sm leading-6 text-[#173d66]/72">
                  Administration und operative Teams erhalten jeweils den passenden, sicheren Zugang.
                </p>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#173d66]/10 px-4 py-6 text-center text-sm text-[#173d66]/58">
        &copy; {new Date().getFullYear()} Meisterplaner
      </footer>
    </div>
  );
}
