import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, unwrap } from "./client";
import type { components } from "./schema";

export const meQueryKey = ["me"] as const;

// GET /api/auth/me is the auth source of truth: the cookie is httpOnly, so
// this request is the only way the UI learns whether it is logged in.
export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: () => unwrap(api.GET("/api/auth/me")),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export type UserLogin = components["schemas"]["UserLogin"];

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UserLogin) => unwrap(api.POST("/api/auth/login", { body })),
    onSuccess: (user) => queryClient.setQueryData(meQueryKey, user),
  });
}

export type UserCreate = components["schemas"]["UserCreate"];

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UserCreate) => unwrap(api.POST("/api/auth/register", { body })),
    onSuccess: (user) => queryClient.setQueryData(meQueryKey, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error, response } = await api.POST("/api/auth/logout");
      if (error !== undefined) throw new ApiError(response.status, "Logout failed");
    },
    // Everything cached belongs to the user who just left.
    onSuccess: () => queryClient.clear(),
  });
}
