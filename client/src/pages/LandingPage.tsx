import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getInviteReturnPath,
  getInviteToken,
  getInvitationRoleLabel,
} from "@/features/invitations/shared";
import { useInvitationPreview } from "@/features/invitations/useInvitationPreview";
import {
  ArrowRight,
  ClipboardCheck,
  Clock,
  HardHat,
  Mail,
} from "lucide-react";

export default function LandingPage() {
  const inviteToken = getInviteToken();
  const returnTo = getInviteReturnPath(inviteToken);
  const loginHref = inviteToken
    ? `/api/login?next=${encodeURIComponent(returnTo)}`
    : "/api/login";
  const signupHref = inviteToken
    ? `/api/signup?next=${encodeURIComponent(returnTo)}`
    : "/api/signup";

  const { data: invitation, error: invitationError } = useInvitationPreview(inviteToken);

  const inviteTitle = invitation
    ? `Einladung von ${invitation.companyName}`
    : "Einsatzplanung, Zeiterfassung und Nachweis";
  const inviteSubtitle = invitation
    ? `${invitation.firstName} ${invitation.lastName} soll als ${
        getInvitationRoleLabel(invitation.role)
      } beitreten.`
    : "Wer ist heute wo? Was ist zu tun? Wie viele Stunden wurden geleistet? Einfach, mobil und sofort einsatzbereit.";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
              <HardHat className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">Der Digitale Polier</span>
          </div>

          <div className="flex items-center gap-2">
            <a href={loginHref} data-testid="button-login-header">
              <Button size="sm" variant="outline">
                Anmelden
              </Button>
            </a>
            <a href={signupHref} data-testid="button-signup-header">
              <Button size="sm">
                {inviteToken ? "Einladung annehmen" : "Registrieren"}
              </Button>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="px-4 py-20">
          <div className="mx-auto max-w-3xl text-center">
            {inviteToken && invitation && (
              <div className="mb-8">
                <Card className="mx-auto max-w-xl border-primary/20 bg-primary/5 p-5 text-left">
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
                        Melde dich an oder registriere dich mit dieser E-Mail-Adresse.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {inviteToken && invitationError && (
              <div className="mb-8">
                <Card className="mx-auto max-w-xl border-destructive/20 bg-destructive/5 p-5 text-left">
                  <p className="text-sm font-semibold text-destructive">
                    Der Einladungslink ist ungueltig oder abgelaufen.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Bitte lasse dir einen neuen Link senden oder registriere deinen eigenen Betrieb.
                  </p>
                </Card>
              </div>
            )}

            <h1
              className="mb-6 text-4xl font-bold tracking-tight md:text-5xl"
              data-testid="text-hero-title"
            >
              {inviteTitle}
              {!inviteToken && (
                <>
                  <br />
                  <span className="text-muted-foreground">
                    fuer kleine Handwerksbetriebe
                  </span>
                </>
              )}
            </h1>

            <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground">
              {inviteSubtitle}
            </p>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={signupHref}
                data-testid={inviteToken ? "button-accept-invite-hero" : "button-signup-hero"}
              >
                <Button size="lg" className="h-14 gap-2 px-8 text-lg">
                  {inviteToken ? "Einladung annehmen" : "Kostenlos registrieren"}
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </a>
              <a href={loginHref} data-testid="button-login-hero">
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg">
                  {inviteToken ? "Ich habe bereits ein Konto" : "Bereits Kunde? Anmelden"}
                </Button>
              </a>
            </div>

            {!inviteToken && (
              <p className="mt-3 text-sm text-muted-foreground">
                Kostenlos loslegen. Keine Kreditkarte noetig.
              </p>
            )}
          </div>
        </section>

        <section className="bg-card/50 px-4 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-10 text-center text-2xl font-bold">
              Drei Fragen, eine App
            </h2>

            <div className="grid gap-6 md:grid-cols-3">
              <Card className="p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-blue-100">
                  <ClipboardCheck className="h-5 w-5 text-blue-700" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Wer ist heute wo?</h3>
                <p className="text-sm text-muted-foreground">
                  Einsatzplan auf einen Blick. Mitarbeiter, Auftraege und Tage
                  in einer Uebersicht.
                </p>
              </Card>

              <Card className="p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-green-100">
                  <Clock className="h-5 w-5 text-green-700" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Was ist der Status?</h3>
                <p className="text-sm text-muted-foreground">
                  Fahrt, Ankunft, Pause, fertig. Klare Statusaktionen per
                  Knopfdruck.
                </p>
              </Card>

              <Card className="p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-amber-100">
                  <ClipboardCheck className="h-5 w-5 text-amber-700" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">
                  Ist alles dokumentiert?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Zeiten, Notizen und Probleme werden direkt am Einsatz dokumentiert.
                </p>
              </Card>
            </div>
          </div>
        </section>

        <section className="px-4 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-2xl font-bold">Gebaut fuer die Baustelle</h2>
            <p className="mb-6 text-muted-foreground">
              Grosse Buttons, klare Farben und mobile Bedienung, auch wenn wenig
              Zeit ist.
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              {["PV / Solar", "Waermepumpen", "SHK", "Montage", "Service"].map(
                (tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-muted px-3 py-1.5 text-sm text-muted-foreground"
                  >
                    {tag}
                  </span>
                ),
              )}
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
