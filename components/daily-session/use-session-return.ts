"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { sessionReturnHref } from "./navigation";

export function useSessionReturn() {
  const searchParams = useSearchParams();
  return useMemo(
    () => ({
      exitHref:
        searchParams.get("returnTo") === "/today" ? "/today" : null,
      completedHref: sessionReturnHref(searchParams),
      technicalHref: sessionReturnHref(searchParams, "technical"),
    }),
    [searchParams],
  );
}
