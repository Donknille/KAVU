import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export function getRequestErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : fallbackMessage;
}

export async function refreshAuthState() {
  await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
}

type RedirectingAuthMutationOptions<TData, TVariables> = {
  mutationFn: (payload: TVariables) => Promise<TData>;
  redirectTo: string;
  errorTitle: string;
  fallbackErrorMessage: string;
};

export function useRedirectingAuthMutation<TData = unknown, TVariables = void>({
  mutationFn,
  redirectTo,
  errorTitle,
  fallbackErrorMessage,
}: RedirectingAuthMutationOptions<TData, TVariables>) {
  const { toast } = useToast();

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await refreshAuthState();
      window.location.href = redirectTo;
    },
    onError: (error) => {
      toast({
        title: errorTitle,
        description: getRequestErrorMessage(error, fallbackErrorMessage),
        variant: "destructive",
      });
    },
  });
}
