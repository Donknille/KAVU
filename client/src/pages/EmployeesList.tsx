import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
  getInvitationRoleLabel,
} from "@/features/invitations/shared";
import { PendingInvitationsSection } from "@/features/invitations/PendingInvitationsSection";
import {
  EMPTY_INVITATION_FORM,
  useCompanyInvitations,
  useInvitationActions,
  type InvitationFormState,
} from "@/features/invitations/useInvitationAdmin";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Phone, Plus, UserPlus, Users } from "lucide-react";

type EmployeeRecord = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: "admin" | "employee";
  isActive: boolean;
  color?: string | null;
};

export default function EmployeesList() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    role: "employee" as "admin" | "employee",
  });
  const [inviteForm, setInviteForm] = useState<InvitationFormState>(EMPTY_INVITATION_FORM);

  const { data: employees, isLoading } = useQuery<EmployeeRecord[]>({
    queryKey: ["/api/employees"],
  });

  const { pendingInvitations, isLoading: invitationsLoading } = useCompanyInvitations();

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) =>
      apiRequest("POST", "/api/employees", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setShowCreate(false);
      setForm({ firstName: "", lastName: "", phone: "", role: "employee" });
      toast({ title: "Mitarbeiter erstellt" });
    },
    onError: () => {
      toast({ title: "Fehler", variant: "destructive" });
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
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
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
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
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {emp.phone && (
                        <span className="flex items-center gap-0.5">
                          <Phone className="h-3 w-3" />
                          {emp.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
                  onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                  required
                  data-testid="input-emp-firstname"
                />
              </div>
              <div>
                <Label>Nachname</Label>
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                  required
                  data-testid="input-emp-lastname"
                />
              </div>
            </div>
            <div>
              <Label>Telefon</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+49..."
                data-testid="input-emp-phone"
              />
            </div>
            <div>
              <Label>Rolle</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((p) => ({ ...p, role: v as "admin" | "employee" }))}
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
    </div>
  );
}
