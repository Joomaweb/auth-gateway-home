import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Subscribe to Postgres changes on a Supabase table and call onChange on any
 * INSERT / UPDATE / DELETE. Cleans up on unmount. Debounced 800ms to coalesce
 * bursts (e.g. bulk product edits) into a single reload.
 */
export function useRealtime(
  table: string,
  onChange: () => void,
  filter?: string,
) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (!table) return; // allow conditional subscriptions (pass "" to skip)
    let timer: ReturnType<typeof setTimeout> | undefined;
    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cbRef.current(), 800);
    };
    const channelName = `rt-${table}-${filter ?? "all"}-${Math.random().toString(36).slice(2, 8)}`;
    const ch = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) } as never,
        trigger,
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [table, filter]);
}
