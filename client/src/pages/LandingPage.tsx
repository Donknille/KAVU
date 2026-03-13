import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getInviteReturnPath,
  getInviteToken,
  getInvitationRoleLabel,
} from "@/features/invitations/shared";
import { useInvitationPreview } from "@/features/invitations/useInvitationPreview";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

const INITIAL_REGISTER_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
};

const INITIAL_LOGIN_FORM = {
  email: "",
  password: "",
};

export default function LandingPage() {
  const { toast } = useToast();
  const inviteToken = getInviteToken();
  const returnTo = getInviteReturnPath(inviteToken);
  const { data: invitation, error: invitationError } = useInvitationPreview(inviteToken);
  const [registerForm, setRegisterForm] = useState(INITIAL_REGISTER_FORM);
  const [loginForm, setLoginForm] = useState(INITIAL_LOGIN_FORM);
  const [companyAccessCode, setCompanyAccessCode] = useState("");
  const [employeeLoginId, setEmployeeLoginId] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");

  const registerMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/auth/register", registerForm),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      window.location.href = inviteToken ? returnTo : "/";
    },
    onError: (error) => {
      toast({
        title: "Registrierung fehlgeschlagen",
        description:
          error instanceof Error
            ? error.message.replace(/^\d+:\s*/, "")
            : "Bitte pruefe deine Eingaben.",
        variant: "destructive",
      });
    },
  });

  const loginMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/auth/login/password", loginForm),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      window.location.href = inviteToken ? returnTo : "/";
    },
    onError: (error) => {
      toast({
        title: "Login fehlgeschlagen",
        description:
          error instanceof Error
            ? error.message.replace(/^\d+:\s*/, "")
            : "Bitte pruefe E-Mail und Passwort.",
        variant: "destructive",
      });
    },
  });

  const employeeLoginMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/auth/employee-login", {
        companyAccessCode,
        loginId: employeeLoginId,
        password: employeePassword,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      window.location.href = "/";
    },
    onError: (error) => {
      toast({
        title: "Mitarbeiter-Login fehlgeschlagen",
        description:
          error instanceof Error
            ? error.message.replace(/^\d+:\s*/, "")
            : "Bitte pruefe Betriebscode, Benutzername und Passwort.",
        variant: "destructive",
      });
    },
  });

  const inviteTitle = invitation
    ? `Einladung von ${invitation.companyName}`
    : "Einsatzplanung, Zeiterfassung und Nachweis";
  const inviteSubtitle = invitation
    ? `${invitation.firstName} ${invitation.lastName} soll als ${
        getInvitationRoleLabel(invitation.role)
      } beitreten.`
    : "Firmeninhaber registrieren sich mit E-Mail und Passwort. Mitarbeiter melden sich mit Betriebscode und Benutzername an.";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
              <HardHat className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">Der Digitale Polier</span>
          </div>

          <div className="flex items-center gap-2">
            <a href="#admin-auth" data-testid="button-login-header">
              <Button size="sm" variant="outline">
                Admin-Zugang
              </Button>
            </a>
            <a href="#employee-access" data-testid="button-employee-header">
              <Button size="sm">
                Mitarbeiter
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
                        Erstelle ein Konto oder melde dich mit dieser E-Mail-Adresse an.
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
                    Bitte lasse dir einen neuen Link senden oder richte deinen eigenen Betrieb ein.
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
                  <span className="text-muted-foreground">fuer kleine Handwerksbetriebe</span>
                </>
              )}
            </h1>

            <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground">
              {inviteSubtitle}
            </p>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#admin-auth" data-testid="button-signup-hero">
                <Button size="lg" className="h-14 gap-2 px-8 text-lg">
                  {inviteToken ? "Per E-Mail fortfahren" : "Betrieb registrieren"}
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </a>
              <a href="#employee-access" data-testid="button-employee-login-hero">
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg">
                  Mitarbeiter anmelden
                </Button>
              </a>
            </div>
          </div>
        </section>

        <section id="admin-auth" className="px-4 pb-12">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="p-6 md:p-8">
                <div className="mb-6 flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserRoundPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Admin- und Inhaber-Zugang</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Kein Google-Login noetig. Firmeninhaber und Buero-Mitarbeiter arbeiten mit E-Mail und Passwort direkt in KAVU.
                    </p>
                  </div>
                </div>

                <Tabs defaultValue="register" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="register">Registrieren</TabsTrigger>
                    <TabsTrigger value="login">Anmelden</TabsTrigger>
                  </TabsList>

                  <TabsContent value="register" className="mt-4">
                    <form
                      className="space-y-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        registerMutation.mutate();
                      }}
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="register-first-name">Vorname</Label>
                          <Input
                            id="register-first-name"
                            value={registerForm.firstName}
                            onChange={(event) =>
                              setRegisterForm((current) => ({
                                ...current,
                                firstName: event.target.value,
                              }))
                            }
                            data-testid="input-register-firstname"
                          />
                        </div>
                        <div>
                          <Label htmlFor="register-last-name">Nachname</Label>
                          <Input
                            id="register-last-name"
                            value={registerForm.lastName}
                            onChange={(event) =>
                              setRegisterForm((current) => ({
                                ...current,
                                lastName: event.target.value,
                              }))
                            }
                            data-testid="input-register-lastname"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="register-email">E-Mail</Label>
                        <Input
                          id="register-email"
                          type="email"
                          value={registerForm.email}
                          onChange={(event) =>
                            setRegisterForm((current) => ({
                              ...current,
                              email: event.target.value,
                            }))
                          }
                          data-testid="input-register-email"
                        />
                      </div>
                      <div>
                        <Label htmlFor="register-password">Passwort</Label>
                        <Input
                          id="register-password"
                          type="password"
                          value={registerForm.password}
                          onChange={(event) =>
                            setRegisterForm((current) => ({
                              ...current,
                              password: event.target.value,
                            }))
                          }
                          data-testid="input-register-password"
                        />
                      </div>
                      <Button
                        type="submit"
                        className="h-12 w-full text-base"
                        disabled={
                          registerMutation.isPending ||
                          !registerForm.firstName ||
                          !registerForm.lastName ||
                          !registerForm.email ||
                          !registerForm.password
                        }
                        data-testid="button-register-password"
                      >
                        {registerMutation.isPending ? "Konto wird erstellt..." : inviteToken ? "Konto erstellen und Einladung annehmen" : "Betrieb starten"}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="login" className="mt-4">
                    <form
                      className="space-y-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        loginMutation.mutate();
                      }}
                    >
                      <div>
                        <Label htmlFor="login-email">E-Mail</Label>
                        <Input
                          id="login-email"
                          type="email"
                          value={loginForm.email}
                          onChange={(event) =>
                            setLoginForm((current) => ({
                              ...current,
                              email: event.target.value,
                            }))
                          }
                          data-testid="input-login-email"
                        />
                      </div>
                      <div>
                        <Label htmlFor="login-password">Passwort</Label>
                        <Input
                          id="login-password"
                          type="password"
                          value={loginForm.password}
                          onChange={(event) =>
                            setLoginForm((current) => ({
                              ...current,
                              password: event.target.value,
                            }))
                          }
                          data-testid="input-login-password"
                        />
                      </div>
                      <Button
                        type="submit"
                        className="h-12 w-full text-base"
                        disabled={loginMutation.isPending || !loginForm.email || !loginForm.password}
                        data-testid="button-login-password"
                      >
                        {loginMutation.isPending ? "Anmeldung laeuft..." : inviteToken ? "Anmelden und Einladung aufrufen" : "Admin anmelden"}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </Card>

              <Card id="employee-access" className="p-6 md:p-8">
                <div className="mb-6 flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Mitarbeiterzugang ohne eigene E-Mail</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Der Admin legt Zugangsdaten an, druckt sie aus und der Mitarbeiter meldet sich direkt mit Betriebscode an.
                    </p>
                  </div>
                </div>

                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    employeeLoginMutation.mutate();
                  }}
                >
                  <div>
                    <Label htmlFor="company-access-code">Betriebscode</Label>
                    <Input
                      id="company-access-code"
                      value={companyAccessCode}
                      onChange={(event) => setCompanyAccessCode(event.target.value)}
                      placeholder="z. B. KAVU2026"
                      data-testid="input-company-access-code"
                    />
                  </div>
                  <div>
                    <Label htmlFor="employee-login-id">Benutzername</Label>
                    <Input
                      id="employee-login-id"
                      value={employeeLoginId}
                      onChange={(event) => setEmployeeLoginId(event.target.value)}
                      placeholder="max.mueller"
                      data-testid="input-employee-login-id"
                    />
                  </div>
                  <div>
                    <Label htmlFor="employee-password">Passwort</Label>
                    <Input
                      id="employee-password"
                      type="password"
                      value={employeePassword}
                      onChange={(event) => setEmployeePassword(event.target.value)}
                      data-testid="input-employee-password"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="h-12 w-full text-base"
                    disabled={
                      employeeLoginMutation.isPending ||
                      !companyAccessCode ||
                      !employeeLoginId ||
                      !employeePassword
                    }
                    data-testid="button-employee-login"
                  >
                    <KeyRound className="mr-2 h-4 w-4" />
                    {employeeLoginMutation.isPending ? "Anmeldung laeuft..." : "Als Mitarbeiter anmelden"}
                  </Button>
                </form>
              </Card>
            </div>
          </div>
        </section>

        <section className="bg-card/50 px-4 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-10 text-center text-2xl font-bold">Drei Fragen, eine App</h2>

            <div className="grid gap-6 md:grid-cols-3">
              <Card className="p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-blue-100">
                  <ClipboardCheck className="h-5 w-5 text-blue-700" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Wer ist heute wo?</h3>
                <p className="text-sm text-muted-foreground">
                  Einsatzplan auf einen Blick. Mitarbeiter, Auftraege und Tage in einer Uebersicht.
                </p>
              </Card>

              <Card className="p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-green-100">
                  <Clock className="h-5 w-5 text-green-700" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Was ist der Status?</h3>
                <p className="text-sm text-muted-foreground">
                  Fahrt, Ankunft, Pause, fertig. Klare Statusaktionen per Knopfdruck.
                </p>
              </Card>

              <Card className="p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-amber-100">
                  <ClipboardCheck className="h-5 w-5 text-amber-700" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Ist alles dokumentiert?</h3>
                <p className="text-sm text-muted-foreground">
                  Zeiten, Notizen und Probleme werden direkt am Einsatz dokumentiert.
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
