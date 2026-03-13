import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/features/auth/AuthShell";
import { PasswordField } from "@/features/auth/PasswordField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const INITIAL_EMPLOYEE_LOGIN_FORM = {
  companyAccessCode: "",
  loginId: "",
  password: "",
};

export default function EmployeeLoginPage() {
  const { toast } = useToast();
  const [form, setForm] = useState(INITIAL_EMPLOYEE_LOGIN_FORM);

  const employeeLoginMutation = useMutation({
    mutationFn: async (payload: typeof form) =>
      apiRequest("POST", "/api/auth/employee-login", payload),
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

  return (
    <AuthShell
      title="Mitarbeiter anmelden"
      subtitle="Fuer Teams ohne eigene E-Mail-Adresse. Der Chef oder Admin gibt Betriebscode, Benutzername und Passwort aus."
      asideEyebrow="Mitarbeiterzugang"
      asideTitle="Direkter Baustellen-Zugang ohne E-Mail"
      asideDescription="Der mobile Einstieg bleibt schlank: nur Betriebscode, Benutzername und Passwort. Danach landet der Mitarbeiter direkt in der Tagesansicht."
      asideItems={[
        "Auch fuer kleine Betriebe ohne eigene Mitarbeiter-E-Mail",
        "Temporare Passwoerter werden beim ersten Login geaendert",
        "Perfekt fuer Homescreen und PWA auf dem Handy",
      ]}
      footer={
        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild variant="outline" className="h-11">
            <Link href="/login/admin">Admin anmelden</Link>
          </Button>
          <Button asChild variant="ghost" className="h-11">
            <Link href="/register/admin">Betrieb registrieren</Link>
          </Button>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          employeeLoginMutation.mutate(form);
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="company-access-code">Betriebscode</Label>
          <Input
            id="company-access-code"
            className="h-12 text-base uppercase"
            autoComplete="off"
            autoCapitalize="characters"
            value={form.companyAccessCode}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                companyAccessCode: event.target.value.toUpperCase(),
              }))
            }
            placeholder="z. B. KAVU2026"
            data-testid="input-company-access-code"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="employee-login-id">Benutzername</Label>
          <Input
            id="employee-login-id"
            className="h-12 text-base"
            autoComplete="username"
            autoCapitalize="none"
            value={form.loginId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                loginId: event.target.value,
              }))
            }
            placeholder="max.mueller"
            data-testid="input-employee-login-id"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="employee-password">Passwort</Label>
          <PasswordField
            id="employee-password"
            className="h-12 text-base"
            autoComplete="current-password"
            value={form.password}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            data-testid="input-employee-password"
          />
        </div>

        <Button
          type="submit"
          className="h-12 w-full text-base"
          disabled={
            employeeLoginMutation.isPending ||
            !form.companyAccessCode ||
            !form.loginId ||
            !form.password
          }
          data-testid="button-employee-login"
        >
          {employeeLoginMutation.isPending ? "Anmeldung laeuft..." : "Als Mitarbeiter anmelden"}
        </Button>
      </form>
    </AuthShell>
  );
}
