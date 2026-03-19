import { useQuery } from "@tanstack/react-query";
import type { MeResponse } from "@/lib/api-types";
import { QK } from "@/lib/queryKeys";

export const CURRENT_SESSION_QUERY_KEY = [QK.ME] as const;

export function useCurrentSession() {
  return useQuery<MeResponse>({
    queryKey: CURRENT_SESSION_QUERY_KEY,
  });
}
