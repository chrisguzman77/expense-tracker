import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap, unwrapVoid } from "./client";
import type { components } from "./schema";
import { transactionsQueryKey } from "./transactions";

export type Account = components["schemas"]["AccountRead"];
export type AccountCreate = components["schemas"]["AccountCreate"];
export type AccountType = Account["type"];

export const accountsQueryKey = ["accounts"] as const;

export function useAccounts() {
  return useQuery({
    queryKey: accountsQueryKey,
    queryFn: () => unwrap(api.GET("/api/accounts")),
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AccountCreate) => unwrap(api.POST("/api/accounts", { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountsQueryKey }),
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      unwrapVoid(api.DELETE("/api/accounts/{account_id}", { params: { path: { account_id: id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountsQueryKey }),
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: AccountCreate }) =>
      unwrap(api.PUT("/api/accounts/{account_id}", { params: { path: { account_id: id } }, body })),
    // Transaction rows show the account's name.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: accountsQueryKey }),
        queryClient.invalidateQueries({ queryKey: transactionsQueryKey }),
      ]),
  });
}
