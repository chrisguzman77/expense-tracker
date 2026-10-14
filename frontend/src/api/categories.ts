import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap, unwrapVoid } from "./client";
import type { components } from "./schema";
import { summaryQueryKey } from "./summary";

export type Category = components["schemas"]["CategoryRead"];
export type CategoryCreate = components["schemas"]["CategoryCreate"];

export const categoriesQueryKey = ["categories"] as const;

// The summary lists every category (with a 0 total if unused), so it changes too.
function invalidateCategoryData(queryClient: QueryClient) {
  return Promise.all([
    // "all": the new-category screen has no observer of the list, and the transaction
    // form mounts right after, so an inactive query must be refetched before navigating.
    queryClient.invalidateQueries({ queryKey: categoriesQueryKey, refetchType: "all" }),
    queryClient.invalidateQueries({ queryKey: summaryQueryKey }),
  ]);
}

export function useCategories() {
  return useQuery({
    queryKey: categoriesQueryKey,
    queryFn: () => unwrap(api.GET("/api/categories")),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CategoryCreate) => unwrap(api.POST("/api/categories", { body })),
    onSuccess: () => invalidateCategoryData(queryClient),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      unwrapVoid(
        api.DELETE("/api/categories/{category_id}", { params: { path: { category_id: id } } }),
      ),
    onSuccess: () => invalidateCategoryData(queryClient),
  });
}
