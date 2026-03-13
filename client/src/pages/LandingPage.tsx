import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  HardHat,
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
    : "Einsatzplanung fuer kleine Handwerksbetriebe";
  const subtitle = invitation
    ? `${invitation.firstName} ${invitation.lastName} soll als ${getInvitationRoleLabel(invitation.role)} beitreten.`
    : "Admins und Inhaber gehen direkt in den Login. Mitarbeiter melden sich mit Betriebscode und Benutzername an.";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-background/85 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
              <HardHat className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-base font-bold">Der Digitale Polier</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Zugriff waehlen
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={adminLoginHref} data-testid="button-login-header">
                Admin
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/login/employee" data-testid="button-employee-header">
                Mitarbeiter
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="px-4 py-10 md:py-16">
          <div className="mx-auto max-w-4xl">
            {inviteToken && invitation && (
              <Card className="mx-auto mb-6 max-w-2xl rounded-3xl border-primary/20 bg-primary/5 p-5 text-left">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Einladung erkannt</p>
                    <p className="text-sm text-muted-foreground">
                      {invitation.companyName} hat {invitation.email} eingeladen.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Melde dich an oder erstelle ein Konto mit dieser E-Mail-Adresse.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {inviteToken && invitationError && (
              <Card className="mx-auto mb-6 max-w-2xl rounded-3xl border-destructive/20 bg-destructive/5 p-5 text-left">
                <p className="text-sm font-semibold text-destructive">
                  Der Einladungslink ist ungueltig oder abgelaufen.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Du kannst dich trotzdem anmelden oder einen eigenen Betrieb registrieren.
                </p>
              </Card>
            )}

            <div className="mx-auto max-w-2xl text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                Professioneller Zugang
              </p>
              <h1
                className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl"
                data-testid="text-hero-title"
              >
                {title}
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
                {subtitle}
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <Card className="rounded-[28px] border p-5 shadow-sm md:p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserRoundPlus className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-2xl font-semibold">Betrieb verwalten</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Fuer Inhaber, Buero und Disposition. Anmeldung und Registrierung erfolgen in einem
                  eigenen, klar strukturierten Bereich.
                </p>
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  <Button asChild className="h-12 text-base" data-testid="button-admin-login-primary">
                    <Link href={adminLoginHref}>
                      {inviteToken ? "Mit E-Mail anmelden" : "Admin anmelden"}
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="h-12 text-base"
                    data-testid="button-admin-register-primary"
                  >
                    <Link href={adminRegisterHref}>
                      {inviteToken ? "Konto erstellen" : "Betrieb registrieren"}
                    </Link>
                  </Button>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Anmeldung mit E-Mail-Adresse und Passwort.
                </p>
              </Card>

              <Card className="rounded-[28px] border p-5 shadow-sm md:p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Shield className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-2xl font-semibold">Mitarbeiter anmelden</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Fuer operative Teams ohne persoenliche E-Mail-Adresse. Anmeldung mit Betriebscode,
                  Benutzername und Passwort.
                </p>
                <div className="mt-6">
                  <Button
                    asChild
                    variant="outline"
                    className="h-12 w-full justify-between text-base"
                    data-testid="button-employee-login-hero"
                  >
                    <Link href="/login/employee">
                      Mitarbeiterzugang
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Zugangsdaten koennen intern sicher weitergegeben oder ausgedruckt werden.
                </p>
              </Card>
            </div>
          </div>
        </section>

        <section className="bg-card/50 px-4 py-14 md:py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-semibold tracking-tight">
              {isMobile ? "Fuer den mobilen Einsatz optimiert" : "Die wichtigsten Funktionen im Ueberblick"}
            </h2>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <Card className="rounded-3xl p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-blue-100">
                  <ClipboardCheck className="h-5 w-5 text-blue-700" />
                </div>
                <h3 className="text-lg font-semibold">Wer ist heute wo?</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Auftraege, Teams und Einsatztage in einer klaren Dispositionsansicht.
                </p>
              </Card>

              <Card className="rounded-3xl p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-green-100">
                  <Clock className="h-5 w-5 text-green-700" />
                </div>
                <h3 className="text-lg font-semibold">Was ist der Status?</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Statusmeldungen wie Fahrt, Ankunft, Pause oder Abschluss werden mobil und eindeutig erfasst.
                </p>
              </Card>

              <Card className="rounded-3xl p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-amber-100">
                  <KeyRound className="h-5 w-5 text-amber-700" />
                </div>
                <h3 className="text-lg font-semibold">Passende Zugangsmodelle</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Administration und operative Teams erhalten jeweils den passenden, sicheren Zugang.
                </p>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t px-4 py-6 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Der Digitale Polier
      </footer>
    </div>
  );
}
