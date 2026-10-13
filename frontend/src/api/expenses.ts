import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap, unwrapVoid } from "./client";
import type { components } from "./schema";
import { summaryQueryKey } from "./summary";

export type Expense = components["schemas"]["ExpenseRead"];
export type ExpenseCreate = components["schemas"]["ExpenseCreate"];

export const expensesQueryKey = ["expenses"] as const;

// Monthly totals are computed from expenses, so they go stale together.
function invalidateExpenseData(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: expensesQueryKey }),
    queryClient.invalidateQueries({ queryKey: summaryQueryKey }),
  ]);
}

export function useExpenses() {
  return useQuery({
    queryKey: expensesQueryKey,
    queryFn: () => unwrap(api.GET("/api/expenses")),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ExpenseCreate) => unwrap(api.POST("/api/expenses", { body })),
    onSuccess: () => invalidateExpenseData(queryClient),
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      unwrapVoid(api.DELETE("/api/expenses/{expense_id}", { params: { path: { expense_id: id } } })),
    onSuccess: () => invalidateExpenseData(queryClient),
  });
}
