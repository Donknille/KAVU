import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Phone, X } from "lucide-react";
import {
  getInvitationDeliverySummary,
  getInvitationRoleLabel,
  type InvitationRecord,
} from "./shared";

type PendingInvitationsSectionProps = {
  invitations: InvitationRecord[];
  isLoading: boolean;
  onRevoke: (id: string) => void;
  revokePending: boolean;
};

export function PendingInvitationsSection({
  invitations,
  isLoading,
  onRevoke,
  revokePending,
}: PendingInvitationsSectionProps) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Offene Einladungen</h2>
          <p className="text-sm text-muted-foreground">
            Mitarbeiter registrieren sich über einen persönlichen Link.
          </p>
        </div>
        <Badge variant="secondary">{invitations.length}</Badge>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : invitations.length === 0 ? (
        <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
          Noch keine offenen Einladungen.
        </div>
      ) : (
        <div className="space-y-2">
          {invitations.map((invitation) => {
            const deliverySummary = getInvitationDeliverySummary(invitation);

            return (
              <Card
                key={invitation.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {invitation.firstName} {invitation.lastName}
                    </p>
                    <Badge variant="secondary">
                      {getInvitationRoleLabel(invitation.role)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {invitation.email}
                    </span>
                    {invitation.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {invitation.phone}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Gueltig bis{" "}
                    {new Date(invitation.expiresAt).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </p>
                  <p
                    className={`text-xs ${
                      deliverySummary.tone === "warning"
                        ? "text-amber-700"
                        : "text-muted-foreground"
                    }`}
                  >
                    {deliverySummary.text}
                  </p>
                  {invitation.sendAttempts > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Versandversuche: {invitation.sendAttempts}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => onRevoke(invitation.id)}
                    disabled={revokePending}
                  >
                    <X className="mr-1 h-4 w-4" />
                    Widerrufen
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Card>
  );
}
