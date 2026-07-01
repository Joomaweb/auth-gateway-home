import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { run } from "@/lib/api";

export function useIsAdmin() {
  const { user, loading } = useAuth();
  const adminQuery = useQuery({
    queryKey: ["auth", "is-admin", user?.id],
    enabled: !loading && !!user,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await run(
        { key: `auth:is-admin:${user!.id}`, timeoutMs: 4500, attempts: 2, cacheMs: 5 * 60_000 },
        () => supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user!.id)
          .eq("role", "admin")
          .maybeSingle(),
      );
      if (error) throw error;
      return !!data;
    },
  });

  return {
    isAdmin: !!adminQuery.data,
    checking: loading || (!!user && adminQuery.isPending),
    error: adminQuery.error,
    retry: () => adminQuery.refetch(),
  };
}
