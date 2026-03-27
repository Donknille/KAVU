import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle } from "lucide-react";

function useQueryParam(name: string): string {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) ?? "";
}

export default function ResetPasswordPage() {
  const token = useQueryParam("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwoerter stimmen nicht ueberein.");
      return;
    }
    if (password.length < 8) {
      setError("Mindestens 8 Zeichen.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiRequest("POST", "/api/auth/reset-password", { token, password });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Zuruecksetzen fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--brand-bg)] p-4">
        <Card className="w-full max-w-md rounded-3xl p-8 text-center">
          <h1 className="text-xl font-bold text-[#173d66]">Ungueltiger Link</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Dieser Link ist ungueltig oder abgelaufen.
          </p>
          <a href="/forgot-password">
            <Button className="mt-4">Neuen Link anfordern</Button>
          </a>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--brand-bg)] p-4">
      <Card className="w-full max-w-md rounded-3xl p-8">
        <h1 className="text-xl font-bold text-[#173d66]">Neues Passwort setzen</h1>

        {done ? (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-green-50 p-6 text-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <p className="font-medium text-green-900">Passwort geaendert</p>
            <p className="text-sm text-green-700">Sie koennen sich jetzt mit dem neuen Passwort anmelden.</p>
            <a href="/login/admin">
              <Button className="mt-2">Zum Login</Button>
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label>Neues Passwort</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen"
                required
                autoFocus
              />
            </div>
            <div>
              <Label>Passwort wiederholen</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Passwort bestaetigen"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="h-11 w-full" disabled={loading || !password || !confirmPassword}>
              {loading ? "Wird gespeichert..." : "Passwort setzen"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
