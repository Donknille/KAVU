import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, RefreshCw, LogIn, Building2, Users } from "lucide-react";

type AdminCompany = {
  id: string;
  name: string;
  createdAt: string;
  frozen: boolean;
  trialDaysLeft: number | null;
  accessCode?: string;
  employeeCount?: number;
  jobCount?: number;
  employees?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
  }>;
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function PlatformAdminPage() {
  const [secret, setSecret] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminCompany | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const headers = useCallback(
    () => ({ "X-Admin-Secret": secret, "Content-Type": "application/json" }),
    [secret],
  );

  async function login() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/admin/companies", { headers: headers() });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setCompanies(data);
      setAuthenticated(true);
    } catch (err: any) {
      setError(err.message || "Verbindung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/admin/companies", { headers: headers() });
      if (res.ok) setCompanies(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function loadDetails(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    const res = await fetch(`/admin/companies/${id}`, { headers: headers() });
    if (res.ok) {
      const detail = await res.json();
      setCompanies((prev) =>
        prev.map((c) => (c.id === id ? { ...c, employees: detail.employees } : c)),
      );
      setExpandedId(id);
    }
  }

  async function deleteCompany() {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      const res = await fetch(`/admin/companies/${deleteTarget.id}`, {
        method: "DELETE",
        headers: headers(),
      });
      if (res.ok) {
        setCompanies((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      }
    } finally {
      setDeleteTarget(null);
      setLoading(false);
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Platform Admin
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="Admin Secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={login} disabled={loading || !secret} className="w-full">
              <LogIn className="h-4 w-4 mr-2" />
              {loading ? "Verbinde..." : "Anmelden"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Platform Admin
          </h1>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Aktualisieren
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            {companies.length} {companies.length === 1 ? "Betrieb" : "Betriebe"} registriert
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const res = await fetch("/admin/orphaned-users", { method: "DELETE", headers: headers() });
              if (res.ok) {
                const data = await res.json();
                alert(data.message);
              }
            }}
          >
            Verwaiste User bereinigen
          </Button>
        </div>

        {companies.map((company) => (
          <Card key={company.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg">{company.name}</h3>
                  {company.accessCode && (
                    <p className="text-sm font-mono bg-muted px-2 py-0.5 rounded inline-block">
                      Code: {company.accessCode}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Erstellt: {formatDate(company.createdAt)}
                    {company.employeeCount != null && <> &middot; {company.employeeCount} Mitarbeiter</>}
                    {company.jobCount != null && <> &middot; {company.jobCount} Aufträge</>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadDetails(company.id)}
                  >
                    <Users className="h-4 w-4 mr-1" />
                    {expandedId === company.id ? "Zuklappen" : "Details"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteTarget(company)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {expandedId === company.id && company.employees && (
                <div className="mt-4 border-t pt-4">
                  <h4 className="text-sm font-medium mb-2">
                    Mitarbeiter ({company.employees.length})
                  </h4>
                  {company.employees.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Keine Mitarbeiter</p>
                  ) : (
                    <div className="space-y-1">
                      {company.employees.map((emp) => (
                        <div
                          key={emp.id}
                          className="flex items-center justify-between text-sm py-1"
                        >
                          <span>
                            {emp.firstName} {emp.lastName}
                          </span>
                          <span className="text-muted-foreground">
                            {emp.role === "admin" ? "Admin" : "Mitarbeiter"}
                            {!emp.isActive && " (inaktiv)"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {companies.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Keine Betriebe vorhanden.
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Betrieb endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Betrieb <strong>{deleteTarget?.name}</strong> und alle zugehörigen Daten
              (Mitarbeiter, Aufträge, Einsätze, Zeiteinträge) werden unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteCompany}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
