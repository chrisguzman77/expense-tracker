import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap, unwrapVoid } from "./client";
import type { components } from "./schema";

export type Expense = components["schemas"]["ExpenseRead"];
export type ExpenseCreate = components["schemas"]["ExpenseCreate"];

export const expensesQueryKey = ["expenses"] as const;

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: expensesQueryKey }),
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      unwrapVoid(api.DELETE("/api/expenses/{expense_id}", { params: { path: { expense_id: id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: expensesQueryKey }),
  });
}
