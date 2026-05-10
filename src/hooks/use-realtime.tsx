import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Subscribe to Postgres changes on a Supabase table and call onChange on any
 * INSERT / UPDATE / DELETE. Cleans up on unmount.
 *
 * Requires the table to be added to the `supabase_realtime` publication.
 */
export function useRealtime(
  table: string,
  onChange: () => void,
  filter?: string,
) {
  useEffect(() => {
    const channelName = `rt-${table}-${filter ?? "all"}-${Math.random().toString(36).slice(2, 8)}`;
    const ch = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        // @ts-expect-error supabase-js types are loose for filter
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        () => onChange(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter]);
}
