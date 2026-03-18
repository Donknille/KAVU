import { useQuery } from "@tanstack/react-query";
import type { MeResponse } from "@/lib/api-types";

export const CURRENT_SESSION_QUERY_KEY = ["/api/me"] as const;

export function useCurrentSession() {
  return useQuery<MeResponse>({
    queryKey: CURRENT_SESSION_QUERY_KEY,
  });
}
