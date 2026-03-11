import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Users, Phone } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function EmployeesList() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    role: "employee" as "admin" | "employee",
  });

  const { data: employees, isLoading } = useQuery<any[]>({
    queryKey: ["/api/employees"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/employees", data),
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

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/employees/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    },
  });

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Users className="w-5 h-5" />
          Mitarbeiter
        </h1>
        <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-add-employee">
          <Plus className="w-4 h-4 mr-1" />
          Neu
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : employees?.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Noch keine Mitarbeiter</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {employees?.map((emp: any) => (
            <Card key={emp.id} className="p-3" data-testid={`card-employee-${emp.id}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: emp.color || "#6b7280" }}
                  >
                    {emp.firstName.charAt(0)}
                    {emp.lastName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {emp.firstName} {emp.lastName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {emp.phone && (
                        <span className="flex items-center gap-0.5">
                          <Phone className="w-3 h-3" />
                          {emp.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={`text-xs border-0 ${
                      emp.role === "admin"
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                        : ""
                    }`}
                  >
                    {emp.role === "admin" ? "Admin" : "Mitarbeiter"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`text-xs ${emp.isActive ? "text-green-600" : "text-muted-foreground"}`}
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
                onValueChange={(v) => setForm((p) => ({ ...p, role: v as any }))}
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
              className="w-full h-12 text-base"
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
