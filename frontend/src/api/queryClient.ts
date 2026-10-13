import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { loginMutationKey, meQueryKey } from "./auth";
import { ApiError } from "./client";

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

// The session ended (expired, or logged out everywhere). Drop the cached data
// and let /me find out: its 401 makes RequireAuth redirect to /login.
function endSession(queryClient: QueryClient) {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== meQueryKey[0] });
  void queryClient.invalidateQueries({ queryKey: meQueryKey });
}

export function createQueryClient(): QueryClient {
  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      // Retrying a 401 only delays the redirect; other errors keep the default 3 retries.
      queries: { retry: (failureCount, error) => !isUnauthorized(error) && failureCount < 3 },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        // /me's own 401 is handled by RequireAuth; reacting here would loop.
        if (isUnauthorized(error) && query.queryKey[0] !== meQueryKey[0]) endSession(queryClient);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _onMutateResult, mutation) => {
        if (isUnauthorized(error) && mutation.options.mutationKey?.[0] !== loginMutationKey[0]) {
          endSession(queryClient);
        }
      },
    }),
  });
  return queryClient;
}
