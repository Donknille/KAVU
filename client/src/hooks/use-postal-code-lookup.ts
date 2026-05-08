import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { withPreviewHeaders } from "@/lib/preview-session";

export type PostalCodeLookupResult = {
  city: string;
  federalState?: string;
  district?: string;
} | null;

const ZIP_PATTERN = /^\d{5}$/;
const DEBOUNCE_MS = 400;

async function fetchPostalCode(zip: string): Promise<PostalCodeLookupResult> {
  const response = await fetch(`/api/postal-code/${zip}`, {
    headers: withPreviewHeaders(),
    credentials: "include",
  });
  if (!response.ok) {
    return null;
  }
  return response.json();
}

export function usePostalCodeLookup(zip: string) {
  const [debouncedZip, setDebouncedZip] = useState(zip);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedZip(zip), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [zip]);

  const enabled = ZIP_PATTERN.test(debouncedZip);

  const query = useQuery<PostalCodeLookupResult>({
    queryKey: ["postal-code", debouncedZip],
    queryFn: () => fetchPostalCode(debouncedZip),
    enabled,
    staleTime: 1000 * 60 * 60,
    retry: false,
  });

  return {
    result: enabled ? query.data ?? null : null,
    isLoading: enabled && query.isLoading,
  };
}
