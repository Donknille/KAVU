import { useQuery } from "@tanstack/react-query";

export const CURRENT_SESSION_QUERY_KEY = ["/api/me"] as const;

export function useCurrentSession() {
  return useQuery<any>({
    queryKey: CURRENT_SESSION_QUERY_KEY,
  });
}
