import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { KeyRound, ShieldCheck } from "lucide-react";

type ChangePasswordPageProps = {
  employee?: {
    firstName: string;
    lastName: string;
  } | null;
  company?: {
    name: string;
  } | null;
};

export default function ChangePasswordPage({ employee, company }: ChangePasswordPageProps) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwoerter stimmen nicht ueberein",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Passwort aktualisiert",
        description: "Dein Zugang ist jetzt dauerhaft aktiviert.",
      });
    } catch (error) {
      toast({
        title: "Passwort konnte nicht aktualisiert werden",
        description:
          error instanceof Error
            ? error.message.replace(/^\d+:\s*/, "")
            : "Bitte pruefe dein aktuelles Passwort.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md space-y-6 p-6">
        <div className="space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Passwort jetzt festlegen</h1>
            <p className="text-sm text-muted-foreground">
              {employee
                ? `${employee.firstName} ${employee.lastName} arbeitet jetzt in ${company?.name ?? "deinem Betrieb"}.`
                : "Dein temporaerer Zugang braucht jetzt ein persoenliches Passwort."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="currentPassword">Temporaeres Passwort</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              data-testid="input-current-password"
            />
          </div>
          <div>
            <Label htmlFor="newPassword">Neues Passwort</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              data-testid="input-new-password"
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Passwort wiederholen</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              data-testid="input-confirm-password"
            />
          </div>

          <Button
            type="submit"
            className="h-12 w-full text-base"
            disabled={
              isSubmitting ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword
            }
            data-testid="button-submit-password-change"
          >
            <KeyRound className="mr-2 h-4 w-4" />
            {isSubmitting ? "Passwort wird gespeichert..." : "Passwort speichern"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
