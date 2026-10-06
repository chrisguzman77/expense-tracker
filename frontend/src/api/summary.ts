import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "./client";
import type { components } from "./schema";

export type CategorySummary = components["schemas"]["CategorySummary"];

export function useSummary(year: number, month: number) {
  return useQuery({
    queryKey: ["summary", year, month] as const,
    queryFn: () => unwrap(api.GET("/api/summary", { params: { query: { year, month } } })),
  });
}
