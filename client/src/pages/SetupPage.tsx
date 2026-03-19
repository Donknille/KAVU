import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/BrandMark";
import {
  getInviteToken,
  getInvitationRoleLabel,
} from "@/features/invitations/shared";
import { useInvitationPreview } from "@/features/invitations/useInvitationPreview";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { QK } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { Building2, Mail, UserPlus } from "lucide-react";

export default function SetupPage() {
  const inviteToken = getInviteToken();
  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);
  const [ignoreInvite, setIgnoreInvite] = useState(false);
  const { toast } = useToast();

  const {
    data: invitation,
    isLoading: invitationLoading,
    error: invitationError,
  } = useInvitationPreview(inviteToken, !ignoreInvite);

  const showInvitationCard = Boolean(inviteToken) && !ignoreInvite;
  const hasValidInvitation = showInvitationCard && Boolean(invitation);
  const invitationRoleLabel = useMemo(() => {
    if (!invitation) return "";
    return getInvitationRoleLabel(invitation.role);
  }, [invitation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !firstName || !lastName) return;
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/setup", {
        companyName,
        firstName,
        lastName,
        phone,
      });
      queryClient.invalidateQueries({ queryKey: [QK.ME] });
    } catch {
      toast({
        title: "Fehler",
        description: "Einrichtung fehlgeschlagen. Bitte versuche es erneut.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  async function acceptInvitation() {
    if (!inviteToken) {
      return;
    }

    setIsAcceptingInvite(true);
    try {
      await apiRequest("POST", `/api/invitations/${inviteToken}/accept`);
      queryClient.invalidateQueries({ queryKey: [QK.ME] });
    } catch (error) {
      toast({
        title: "Einladung konnte nicht angenommen werden",
        description:
          error instanceof Error
            ? error.message.replace(/^\d+:\s*/, "")
            : "Bitte prüfe die E-Mail-Adresse deines Kontos oder bitte um einen neuen Link.",
        variant: "destructive",
      });
    } finally {
      setIsAcceptingInvite(false);
    }
  }

  return (
    <div className="brand-grid-shell flex min-h-screen items-center justify-center p-4">
      <Card className="brand-panel w-full max-w-md p-6">
        <div className="mb-6 flex items-center gap-3">
          <BrandMark size={40} />
          <div>
            <h1 className="text-xl font-bold text-[#173d66]">Willkommen</h1>
            <p className="text-sm text-[#173d66]/72">
              {hasValidInvitation ? "Einladung annehmen oder eigenen Betrieb einrichten" : "Richte deinen Betrieb ein"}
            </p>
          </div>
        </div>

        {showInvitationCard && (
          <div className="mb-6">
            {invitationLoading && (
              <Card className="border-dashed p-4">
                <p className="text-sm text-muted-foreground">
                  Einladung wird geladen...
                </p>
              </Card>
            )}

            {hasValidInvitation && invitation && (
              <Card className="space-y-4 border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Einladung für {invitation.companyName}</p>
                    <p className="text-sm text-muted-foreground">
                      {invitation.firstName} {invitation.lastName} soll als {invitationRoleLabel} beitreten.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Einladung an {invitation.email}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                  <div className="rounded-lg border bg-background px-3 py-2">
                    <p className="text-xs uppercase tracking-wide">Firma</p>
                    <p className="mt-1 font-medium text-foreground">{invitation.companyName}</p>
                  </div>
                  <div className="rounded-lg border bg-background px-3 py-2">
                    <p className="text-xs uppercase tracking-wide">Rolle</p>
                    <p className="mt-1 font-medium text-foreground">{invitationRoleLabel}</p>
                  </div>
                </div>

                <Button
                  className="h-12 w-full text-base"
                  onClick={acceptInvitation}
                  disabled={isAcceptingInvite}
                  data-testid="button-accept-invitation"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {isAcceptingInvite ? "Einladung wird angenommen..." : "Einladung annehmen"}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setIgnoreInvite(true)}
                >
                  Stattdessen eigenen Betrieb einrichten
                </Button>
              </Card>
            )}

            {inviteToken && invitationError && !ignoreInvite && (
              <Card className="space-y-3 border-destructive/20 bg-destructive/5 p-4">
                <p className="font-semibold text-destructive">
                  Die Einladung ist ungültig oder abgelaufen.
                </p>
                <p className="text-sm text-muted-foreground">
                  Du kannst stattdessen einen eigenen Betrieb einrichten.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setIgnoreInvite(true)}
                >
                  Eigenen Betrieb einrichten
                </Button>
              </Card>
            )}
          </div>
        )}

        {(!showInvitationCard || ignoreInvite) && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-xl border bg-card/60 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Neuen Betrieb anlegen</p>
              </div>

              <div>
                <Label htmlFor="companyName">Firmenname</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="z.B. Mueller Solartechnik"
                  required
                  data-testid="input-company-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName">Vorname</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  data-testid="input-first-name"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Nachname</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  data-testid="input-last-name"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="phone">Telefon (optional)</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+49..."
                data-testid="input-phone"
              />
            </div>

            <Button
              type="submit"
              className="h-12 w-full text-base"
              disabled={isLoading || !companyName || !firstName || !lastName}
              data-testid="button-submit-setup"
            >
              {isLoading ? "Wird eingerichtet..." : "Betrieb einrichten"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
