import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email });
      setSent(true);
    } catch (err: any) {
      setError(err?.message || "Anfrage fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--brand-bg)] p-4">
      <Card className="w-full max-w-md rounded-3xl p-8">
        <a href="/login/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="h-4 w-4" /> Zurueck zum Login
        </a>

        <h1 className="text-xl font-bold text-[#173d66]">Passwort vergessen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Geben Sie Ihre E-Mail-Adresse ein. Wir senden Ihnen einen Link zum Zuruecksetzen.
        </p>

        {sent ? (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-green-50 p-6 text-center">
            <Mail className="h-8 w-8 text-green-600" />
            <p className="font-medium text-green-900">E-Mail gesendet</p>
            <p className="text-sm text-green-700">
              Falls ein Account mit dieser E-Mail existiert, erhalten Sie in Kuerze einen Link.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label>E-Mail-Adresse</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@firma.de"
                required
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="h-11 w-full" disabled={loading || !email}>
              {loading ? "Wird gesendet..." : "Link senden"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
