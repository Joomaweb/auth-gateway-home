import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export function useUnreadMessages() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", user.id);
      const ids = (data ?? []).map((c) => c.id);
      if (ids.length === 0) {
        if (!cancelled) setCount(0);
        return;
      }
      const { count: c } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", ids)
        .eq("is_admin", true)
        .eq("read_by_user", false);
      if (!cancelled) setCount(c ?? 0);
    };
    load();
    const ch = supabase
      .channel("unread-msgs-" + user.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  return count;
}
