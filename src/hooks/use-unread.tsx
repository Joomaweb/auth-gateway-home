import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { run } from "@/lib/api";

export function useUnreadMessages() {
  const { user } = useAuth();
  const unreadQuery = useQuery({
    queryKey: ["messages", "unread", user?.id],
    enabled: !!user,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await run(
        { key: `unread:conversations:${user!.id}`, timeoutMs: 3500, attempts: 2, cacheMs: 15_000 },
        () => supabase.from("conversations").select("id").eq("user_id", user!.id),
      );
      if (error) throw error;
      const ids = (data ?? []).map((c) => c.id);
      if (ids.length === 0) return 0;
      const { count, error: countError } = await run(
        { key: `unread:count:${ids.join(",")}`, timeoutMs: 3500, attempts: 2, cacheMs: 15_000 },
        () => supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .in("conversation_id", ids)
          .eq("is_admin", true)
          .eq("read_by_user", false),
      );
      if (countError) throw countError;
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!user) return;
    const delay = setTimeout(() => unreadQuery.refetch(), 1200);
    const ch = supabase
      .channel("unread-msgs-" + user.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => unreadQuery.refetch(),
      )
      .subscribe();
    return () => {
      clearTimeout(delay);
      supabase.removeChannel(ch);
    };
  }, [user, unreadQuery]);

  return unreadQuery.data ?? 0;
}
