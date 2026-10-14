import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap, unwrapVoid } from "./client";
import type { components } from "./schema";
import { summaryQueryKey } from "./summary";

export type Transaction = components["schemas"]["TransactionRead"];
export type TransactionCreate = components["schemas"]["TransactionCreate"];

export const transactionsQueryKey = ["transactions"] as const;

// Monthly totals are computed from transactions, so they go stale together.
function invalidateTransactionData(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: transactionsQueryKey }),
    queryClient.invalidateQueries({ queryKey: summaryQueryKey }),
  ]);
}

export function useTransactions() {
  return useQuery({
    queryKey: transactionsQueryKey,
    queryFn: () => unwrap(api.GET("/api/transactions")),
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TransactionCreate) => unwrap(api.POST("/api/transactions", { body })),
    onSuccess: () => invalidateTransactionData(queryClient),
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      unwrapVoid(
        api.DELETE("/api/transactions/{transaction_id}", { params: { path: { transaction_id: id } } }),
      ),
    onSuccess: () => invalidateTransactionData(queryClient),
  });
}
