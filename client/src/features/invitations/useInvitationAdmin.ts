import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiRequestJson, queryClient } from "@/lib/queryClient";
import type {
  InvitationCreateResponse,
  InvitationMutationResponse,
  InvitationRecord,
} from "./shared";

export type InvitationFormState = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: "admin" | "employee";
};

export const EMPTY_INVITATION_FORM: InvitationFormState = {
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  role: "employee",
};

async function copyInviteUrl(inviteUrl: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(inviteUrl);
    return true;
  } catch {
    return false;
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : undefined;
}

async function invalidateCompanyInvitations() {
  await queryClient.invalidateQueries({ queryKey: ["/api/company-invitations"] });
}

export function useCompanyInvitations() {
  const query = useQuery<InvitationRecord[]>({
    queryKey: ["/api/company-invitations"],
  });

  const invitations = query.data ?? [];
  const pendingInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status === "pending"),
    [invitations],
  );

  return {
    ...query,
    invitations,
    pendingInvitations,
  };
}

type UseInvitationActionsOptions = {
  onCreateSuccess?: () => void;
};

export function useInvitationActions(options: UseInvitationActionsOptions = {}) {
  const { toast } = useToast();

  const showInvitationDeliveryToast = async (
    result: InvitationMutationResponse,
    titles: {
      success: string;
      fallback: string;
    },
  ) => {
    const shouldCopyLink = result.delivery.status !== "sent";
    const copied = shouldCopyLink ? await copyInviteUrl(result.inviteUrl) : false;
    const description = copied
      ? `${result.delivery.message} Der Link wurde in die Zwischenablage kopiert.`
      : shouldCopyLink
        ? `${result.delivery.message} ${result.inviteUrl}`
        : result.delivery.message;

    toast({
      title: result.delivery.status === "sent" ? titles.success : titles.fallback,
      description,
      variant: result.delivery.status === "failed" ? "destructive" : undefined,
    });
  };

  const createInvitationMutation = useMutation({
    mutationFn: async (data: InvitationFormState) =>
      apiRequestJson<InvitationCreateResponse>("POST", "/api/company-invitations", data),
    onSuccess: async (result) => {
      await invalidateCompanyInvitations();
      options.onCreateSuccess?.();
      await showInvitationDeliveryToast(result, {
        success: "Einladung gesendet",
        fallback: "Einladung erstellt",
      });
    },
    onError: (error) => {
      toast({
        title: "Einladung fehlgeschlagen",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const resendInvitationMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequestJson<InvitationCreateResponse>("POST", `/api/company-invitations/${id}/resend`),
    onSuccess: async (result) => {
      await invalidateCompanyInvitations();
      await showInvitationDeliveryToast(result, {
        success: "Einladung erneut gesendet",
        fallback: "Einladung neu erstellt",
      });
    },
    onError: (error) => {
      toast({
        title: "Erneutes Senden fehlgeschlagen",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/company-invitations/${id}`),
    onSuccess: async () => {
      await invalidateCompanyInvitations();
      toast({ title: "Einladung widerrufen" });
    },
    onError: () => {
      toast({
        title: "Widerruf fehlgeschlagen",
        variant: "destructive",
      });
    },
  });

  return {
    createInvitationMutation,
    resendInvitationMutation,
    revokeInvitationMutation,
  };
}
