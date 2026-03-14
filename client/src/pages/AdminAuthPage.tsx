import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRedirectingAuthMutation } from "@/features/auth/authFlow";
import { AuthShell } from "@/features/auth/AuthShell";
import { PasswordField } from "@/features/auth/PasswordField";
import {
  getInviteReturnPath,
  getInviteToken,
  getInvitationRoleLabel,
  withInviteToken,
} from "@/features/invitations/shared";
import { useInvitationPreview } from "@/features/invitations/useInvitationPreview";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type AdminAuthPageProps = {
  mode: "login" | "register";
};

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

export default function AdminAuthPage({ mode }: AdminAuthPageProps) {
  const inviteToken = getInviteToken();
  const returnTo = getInviteReturnPath(inviteToken);
  const registerHref = withInviteToken("/register/admin", inviteToken);
  const loginHref = withInviteToken("/login/admin", inviteToken);
  const employeeHref = withInviteToken("/login/employee", inviteToken);
  const { data: invitation, error: invitationError } = useInvitationPreview(inviteToken);
  const [registerForm, setRegisterForm] = useState(INITIAL_REGISTER_FORM);
  const [loginForm, setLoginForm] = useState(INITIAL_LOGIN_FORM);

  const registerMutation = useRedirectingAuthMutation({
    mutationFn: async (payload: typeof registerForm) =>
      apiRequest("POST", "/api/auth/register", payload),
    redirectTo: returnTo,
    errorTitle: "Registrierung fehlgeschlagen",
    fallbackErrorMessage: "Bitte pruefe deine Eingaben.",
  });

  const loginMutation = useRedirectingAuthMutation({
    mutationFn: async (payload: typeof loginForm) =>
      apiRequest("POST", "/api/auth/login/password", payload),
    redirectTo: returnTo,
    errorTitle: "Login fehlgeschlagen",
    fallbackErrorMessage: "Bitte pruefe E-Mail und Passwort.",
  });

  const title =
    mode === "login"
      ? inviteToken
        ? "Anmelden und Einladung fortsetzen"
        : "Admin anmelden"
      : inviteToken
        ? "Konto erstellen und Einladung annehmen"
        : "Betrieb registrieren";
  const subtitle =
    mode === "login"
      ? "Fuer Inhaber, Buero und Disposition. Anmeldung mit E-Mail-Adresse und Passwort."
      : "Registrieren Sie Ihr Inhaberkonto und richten Sie anschliessend den Betrieb ein.";

  const inviteBanner = inviteToken ? (
    invitation ? (
      <Card className="brand-soft-card rounded-3xl p-4">
        <p className="text-sm font-semibold text-[#173d66]">Einladung erkannt</p>
        <p className="mt-1 text-sm text-[#173d66]/72">
          {invitation.companyName} hat {invitation.email} als{" "}
          {getInvitationRoleLabel(invitation.role)} eingeladen.
        </p>
      </Card>
    ) : invitationError ? (
      <Card className="rounded-3xl border-destructive/20 bg-destructive/5 p-4">
        <p className="text-sm font-semibold text-destructive">
          Der Einladungslink ist ungueltig oder abgelaufen.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Sie koennen sich weiterhin anmelden oder einen eigenen Betrieb registrieren.
        </p>
      </Card>
    ) : null
  ) : null;

  return (
    <AuthShell
      title={title}
      subtitle={subtitle}
      banner={inviteBanner}
      asideEyebrow="Admin-Zugang"
      asideTitle="Zugang fuer Administration und Disposition"
      asideDescription="Zentraler Zugang fuer Inhaber, Buero und Disposition mit klarem Anmeldeprozess."
      asideItems={[
        "Anmeldung mit E-Mail-Adresse und Passwort",
        "Sofortiger Zugriff auf Planung, Auftraege und Mitarbeitende",
        "Einladungen werden im Anmeldeprozess automatisch uebernommen",
      ]}
      footer={
        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild variant="outline" className="h-11">
            <Link href={employeeHref}>Mitarbeiterzugang</Link>
          </Button>
          <Button asChild variant="ghost" className="h-11">
            <Link href="/">Zur Startseite</Link>
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 rounded-2xl bg-[#173d66]/6 p-1">
        <Link
          href={loginHref}
          className={cn(
            "rounded-xl px-3 py-2 text-center text-sm font-medium transition-colors",
            mode === "login" ? "bg-white shadow-sm" : "text-muted-foreground",
          )}
          data-testid="link-admin-login"
        >
          Anmelden
        </Link>
        <Link
          href={registerHref}
          className={cn(
            "rounded-xl px-3 py-2 text-center text-sm font-medium transition-colors",
            mode === "register" ? "bg-white shadow-sm" : "text-muted-foreground",
          )}
          data-testid="link-admin-register"
        >
          Registrieren
        </Link>
      </div>

      {mode === "register" ? (
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            registerMutation.mutate(registerForm);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="register-first-name">Vorname</Label>
              <Input
                id="register-first-name"
                className="h-12 text-base"
                autoComplete="given-name"
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
            <div className="space-y-2">
              <Label htmlFor="register-last-name">Nachname</Label>
              <Input
                id="register-last-name"
                className="h-12 text-base"
                autoComplete="family-name"
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

          <div className="space-y-2">
            <Label htmlFor="register-email">E-Mail</Label>
            <Input
              id="register-email"
              type="email"
              className="h-12 text-base"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
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

          <div className="space-y-2">
            <Label htmlFor="register-password">Passwort</Label>
            <PasswordField
              id="register-password"
              className="h-12 text-base"
              autoComplete="new-password"
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
            {registerMutation.isPending
              ? "Konto wird erstellt..."
              : inviteToken
                ? "Konto erstellen und Einladung aufrufen"
                : "Betrieb starten"}
          </Button>
        </form>
      ) : (
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            loginMutation.mutate(loginForm);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="login-email">E-Mail</Label>
            <Input
              id="login-email"
              type="email"
              className="h-12 text-base"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
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

          <div className="space-y-2">
            <Label htmlFor="login-password">Passwort</Label>
            <PasswordField
              id="login-password"
              className="h-12 text-base"
              autoComplete="current-password"
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
            {loginMutation.isPending
              ? "Anmeldung laeuft..."
              : inviteToken
                ? "Anmelden und Einladung fortsetzen"
                : "Admin anmelden"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
