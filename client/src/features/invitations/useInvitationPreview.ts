import { useQuery } from "@tanstack/react-query";
import type { InvitationPreview } from "./shared";

export function useInvitationPreview(
  inviteToken: string | null,
  enabled = true,
) {
  return useQuery<InvitationPreview>({
    queryKey: [`/api/invitations/${inviteToken}`],
    enabled: Boolean(inviteToken) && enabled,
    retry: false,
  });
}
