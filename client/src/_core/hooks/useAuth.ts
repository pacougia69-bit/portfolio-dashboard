import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useMemo } from "react";

// Demo user - always available, no authentication required
const DEMO_USER = {
  id: 1,
  openId: 'demo-user',
  name: 'Demo User',
  email: 'demo@portfolio.local',
  role: 'user' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(_options?: UseAuthOptions) {
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    // Always return demo user - no authentication required
    const user = meQuery.data || DEMO_USER;
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(user)
    );
    return {
      user,
      loading: false, // Never show loading state
      error: null, // Never show error state
      isAuthenticated: true, // Always authenticated
    };
  }, [meQuery.data]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
