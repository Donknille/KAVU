import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getInvitationRoleLabel } from "@/features/invitations/shared";
import { PendingInvitationsSection } from "@/features/invitations/PendingInvitationsSection";
import {
  EMPTY_INVITATION_FORM,
  useCompanyInvitations,
  useInvitationActions,
  type InvitationFormState,
} from "@/features/invitations/useInvitationAdmin";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiRequestJson, queryClient } from "@/lib/queryClient";
import {
  KeyRound,
  Mail,
  Phone,
  Plus,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";

type EmployeeRecord = {
  id: string;
  userId?: string | null;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: "admin" | "employee";
  isActive: boolean;
  color?: string | null;
  loginId?: string | null;
  mustChangePassword?: boolean;
};

type EmployeeAccessPayload = {
  companyAccessCode: string;
  loginId: string;
  temporaryPassword: string;
  mustChangePassword: boolean;
};

type EmployeeMutationResponse = {
  employee: EmployeeRecord;
  company?: {
    id: string;
    name: string;
    accessCode?: string | null;
  } | null;
  access: EmployeeAccessPayload | null;
  delivery: {
    status: string;
    message: string;
  } | null;
};

type CompanyContext = {
  company: {
    id: string;
    name: string;
    accessCode?: string | null;
  } | null;
};

const INITIAL_EMPLOYEE_FORM = {
  firstName: "",
  lastName: "",
  phone: "",
  role: "employee" as "admin" | "employee",
  createAccess: true,
  loginId: "",
  sendCredentialsToAdmin: false,
};

async function copyCredentials(access: EmployeeAccessPayload) {
  const payload = [
    `Betriebscode: ${access.companyAccessCode}`,
    `Benutzername: ${access.loginId}`,
    `Temporaeres Passwort: ${access.temporaryPassword}`,
  ].join("\n");

  await navigator.clipboard.writeText(payload);
}

export default function EmployeesList() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [issuedAccess, setIssuedAccess] = useState<EmployeeMutationResponse | null>(null);
  const [form, setForm] = useState(INITIAL_EMPLOYEE_FORM);
  const [inviteForm, setInviteForm] = useState<InvitationFormState>(EMPTY_INVITATION_FORM);

  const { data: employees, isLoading } = useQuery<EmployeeRecord[]>({
    queryKey: ["/api/employees"],
  });
  const { data: meData } = useQuery<CompanyContext>({
    queryKey: ["/api/me"],
  });
  const { pendingInvitations, isLoading: invitationsLoading } = useCompanyInvitations();

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) =>
      apiRequestJson<EmployeeMutationResponse>("POST", "/api/employees", data),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      setShowCreate(false);
      setForm(INITIAL_EMPLOYEE_FORM);
      setIssuedAccess(result.access ? result : null);
      toast({
        title: result.access ? "Mitarbeiterzugang erstellt" : "Mitarbeiter erstellt",
        description: result.delivery?.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : undefined,
        variant: "destructive",
      });
    },
  });

  const provisionAccessMutation = useMutation({
    mutationFn: async (employeeId: string) =>
      apiRequestJson<EmployeeMutationResponse>("POST", `/api/employees/${employeeId}/access`, {
        sendCredentialsToAdmin: false,
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      setIssuedAccess(result);
      toast({
        title: "Neue Zugangsdaten erzeugt",
        description: result.delivery?.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Zugang konnte nicht erzeugt werden",
        description: error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : undefined,
        variant: "destructive",
      });
    },
  });

  const {
    createInvitationMutation,
    resendInvitationMutation,
    revokeInvitationMutation,
  } = useInvitationActions({
    onCreateSuccess: () => {
      setShowInvite(false);
      setInviteForm(EMPTY_INVITATION_FORM);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/employees/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    },
  });

  const companyAccessCode = meData?.company?.accessCode;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Users className="h-5 w-5" />
          Mitarbeiter
        </h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowInvite(true)}
            data-testid="button-invite-employee"
          >
            <UserPlus className="mr-1 h-4 w-4" />
            Einladen
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreate(true)}
            data-testid="button-add-employee"
          >
            <Plus className="mr-1 h-4 w-4" />
            Neu
          </Button>
        </div>
      </div>

      <Card className="grid gap-4 border-primary/15 bg-card p-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Shield className="h-4 w-4 text-primary" />
            Lokaler Mitarbeiterzugang
          </p>
          <p className="text-sm text-muted-foreground">
            Mitarbeiter ohne eigene E-Mail melden sich mit Betriebscode, Benutzername und Passwort an.
          </p>
        </div>
        <div className="rounded-xl border bg-background px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Betriebscode</p>
          <p className="font-mono text-lg font-semibold">
            {companyAccessCode || "Wird beim ersten Zugang erzeugt"}
          </p>
        </div>
      </Card>

      <PendingInvitationsSection
        invitations={pendingInvitations}
        isLoading={invitationsLoading}
        onResend={(id) => resendInvitationMutation.mutate(id)}
        onRevoke={(id) => revokeInvitationMutation.mutate(id)}
        resendPending={resendInvitationMutation.isPending}
        revokePending={revokeInvitationMutation.isPending}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : employees?.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">Noch keine Mitarbeiter</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {employees?.map((emp) => (
            <Card key={emp.id} className="p-3" data-testid={`card-employee-${emp.id}`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: emp.color || "#6b7280" }}
                  >
                    {emp.firstName.charAt(0)}
                    {emp.lastName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {emp.firstName} {emp.lastName}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {emp.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {emp.phone}
                        </span>
                      )}
                      {emp.loginId && (
                        <span className="rounded-md bg-muted px-2 py-0.5 font-mono">
                          Login: {emp.loginId}
                        </span>
                      )}
                      {emp.mustChangePassword && emp.loginId && (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-amber-800">
                          Passwortwechsel offen
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={`border-0 text-xs ${
                      emp.role === "admin"
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                        : ""
                    }`}
                  >
                    {getInvitationRoleLabel(emp.role)}
                  </Badge>
                  {emp.loginId ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => provisionAccessMutation.mutate(emp.id)}
                      disabled={provisionAccessMutation.isPending}
                      data-testid={`button-reset-access-${emp.id}`}
                    >
                      <KeyRound className="mr-1 h-4 w-4" />
                      Zugang neu setzen
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => provisionAccessMutation.mutate(emp.id)}
                      disabled={provisionAccessMutation.isPending}
                      data-testid={`button-create-access-${emp.id}`}
                    >
                      <KeyRound className="mr-1 h-4 w-4" />
                      Zugang erstellen
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`text-xs ${
                      emp.isActive ? "text-green-600" : "text-muted-foreground"
                    }`}
                    onClick={() =>
                      toggleMutation.mutate({ id: emp.id, isActive: !emp.isActive })
                    }
                    data-testid={`button-toggle-${emp.id}`}
                  >
                    {emp.isActive ? "Aktiv" : "Inaktiv"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mitarbeiter einladen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>E-Mail</Label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(e) =>
                  setInviteForm((current) => ({ ...current, email: e.target.value }))
                }
                placeholder="max@firma.de"
                data-testid="input-invite-email"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vorname</Label>
                <Input
                  value={inviteForm.firstName}
                  onChange={(e) =>
                    setInviteForm((current) => ({ ...current, firstName: e.target.value }))
                  }
                  data-testid="input-invite-firstname"
                />
              </div>
              <div>
                <Label>Nachname</Label>
                <Input
                  value={inviteForm.lastName}
                  onChange={(e) =>
                    setInviteForm((current) => ({ ...current, lastName: e.target.value }))
                  }
                  data-testid="input-invite-lastname"
                />
              </div>
            </div>
            <div>
              <Label>Telefon</Label>
              <Input
                value={inviteForm.phone}
                onChange={(e) =>
                  setInviteForm((current) => ({ ...current, phone: e.target.value }))
                }
                placeholder="+49..."
                data-testid="input-invite-phone"
              />
            </div>
            <div>
              <Label>Rolle</Label>
              <Select
                value={inviteForm.role}
                onValueChange={(value) =>
                  setInviteForm((current) => ({
                    ...current,
                    role: value as "admin" | "employee",
                  }))
                }
              >
                <SelectTrigger data-testid="select-invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Mitarbeiter</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="h-12 w-full text-base"
              onClick={() => createInvitationMutation.mutate(inviteForm)}
              disabled={
                !inviteForm.email ||
                !inviteForm.firstName ||
                !inviteForm.lastName ||
                createInvitationMutation.isPending
              }
              data-testid="button-send-invitation"
            >
              {createInvitationMutation.isPending
                ? "Einladung wird erstellt..."
                : "Einladung erstellen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Neuer Mitarbeiter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vorname</Label>
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm((current) => ({ ...current, firstName: e.target.value }))}
                  required
                  data-testid="input-emp-firstname"
                />
              </div>
              <div>
                <Label>Nachname</Label>
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm((current) => ({ ...current, lastName: e.target.value }))}
                  required
                  data-testid="input-emp-lastname"
                />
              </div>
            </div>
            <div>
              <Label>Telefon</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                placeholder="+49..."
                data-testid="input-emp-phone"
              />
            </div>
            <div>
              <Label>Rolle</Label>
              <Select
                value={form.role}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, role: value as "admin" | "employee" }))
                }
              >
                <SelectTrigger data-testid="select-emp-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Mitarbeiter</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 rounded-xl border bg-card/60 p-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="createAccess"
                  checked={form.createAccess}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({ ...current, createAccess: checked === true }))
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor="createAccess">Lokalen Zugang direkt anlegen</Label>
                  <p className="text-sm text-muted-foreground">
                    Fuer Mitarbeiter ohne eigene E-Mail. Das System erzeugt Benutzername und temporaeres Passwort.
                  </p>
                </div>
              </div>

              {form.createAccess && (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="loginId">Benutzername (optional)</Label>
                    <Input
                      id="loginId"
                      value={form.loginId}
                      onChange={(e) => setForm((current) => ({ ...current, loginId: e.target.value }))}
                      placeholder="Wird sonst automatisch erzeugt"
                      data-testid="input-emp-login-id"
                    />
                  </div>
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="sendCredentialsToAdmin"
                      checked={form.sendCredentialsToAdmin}
                      onCheckedChange={(checked) =>
                        setForm((current) => ({
                          ...current,
                          sendCredentialsToAdmin: checked === true,
                        }))
                      }
                    />
                    <div className="space-y-1">
                      <Label htmlFor="sendCredentialsToAdmin">Zugangsdaten an meine E-Mail senden</Label>
                      <p className="text-sm text-muted-foreground">
                        Funktioniert nur, wenn der E-Mail-Versand in der Plattform konfiguriert ist.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button
              className="h-12 w-full text-base"
              onClick={() => createMutation.mutate(form)}
              disabled={!form.firstName || !form.lastName || createMutation.isPending}
              data-testid="button-save-employee"
            >
              {createMutation.isPending ? "Wird gespeichert..." : "Mitarbeiter anlegen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(issuedAccess)} onOpenChange={(open) => !open && setIssuedAccess(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Zugangsdaten fuer Mitarbeiter</DialogTitle>
          </DialogHeader>
          {issuedAccess?.access && (
            <div className="space-y-4">
              <Card className="space-y-3 border-primary/20 bg-primary/5 p-4">
                <div>
                  <p className="font-semibold">
                    {issuedAccess.employee.firstName} {issuedAccess.employee.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Diese Daten werden nur jetzt vollstaendig angezeigt. Bitte direkt weitergeben oder ausdrucken.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border bg-background px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Betriebscode</p>
                    <p className="mt-1 font-mono text-sm">{issuedAccess.access.companyAccessCode}</p>
                  </div>
                  <div className="rounded-lg border bg-background px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Benutzername</p>
                    <p className="mt-1 font-mono text-sm">{issuedAccess.access.loginId}</p>
                  </div>
                  <div className="rounded-lg border bg-background px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Temporaeres Passwort</p>
                    <p className="mt-1 font-mono text-sm">{issuedAccess.access.temporaryPassword}</p>
                  </div>
                </div>
              </Card>

              {issuedAccess.delivery?.message && (
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {issuedAccess.delivery.message}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await copyCredentials(issuedAccess.access as EmployeeAccessPayload);
                      toast({ title: "Zugangsdaten kopiert" });
                    } catch {
                      toast({
                        title: "Kopieren fehlgeschlagen",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Daten kopieren
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.print()}
                >
                  Drucken
                </Button>
                <Button onClick={() => setIssuedAccess(null)}>Fertig</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
