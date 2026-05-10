import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/messages")({
  component: AdminMessages,
});

type Conv = {
  id: string;
  subject: string;
  user_id: string;
  last_message_at: string;
  profile?: { full_name: string | null; email: string | null };
  unread?: number;
};
type Msg = { id: string; body: string; is_admin: boolean; created_at: string };

function AdminMessages() {
  const { t } = useT();
  const { user } = useAuth();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .order("last_message_at", { ascending: false });
    const list = (data ?? []) as Conv[];
    // load profiles + unread
    const userIds = [...new Set(list.map((c) => c.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("id,full_name,email").in("id", userIds);
    const profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
    (profiles ?? []).forEach((p) => { profileMap[p.id] = { full_name: p.full_name, email: p.email }; });
    const { data: unreadMsgs } = await supabase
      .from("messages")
      .select("conversation_id")
      .eq("is_admin", false)
      .eq("read_by_admin", false);
    const unreadMap: Record<string, number> = {};
    (unreadMsgs ?? []).forEach((m) => { unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] ?? 0) + 1; });
    setConvs(list.map((c) => ({ ...c, profile: profileMap[c.user_id], unread: unreadMap[c.id] ?? 0 })));
    if (!active && list.length > 0) setActive(list[0].id);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-conv-list").on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages" },
      () => load(),
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (!active) return;
    const fetchMsgs = () =>
      supabase.from("messages").select("*").eq("conversation_id", active).order("created_at", { ascending: true })
        .then(({ data }) => {
          setMsgs((data ?? []) as Msg[]);
          setTimeout(() => scrollRef.current?.scrollTo({ top: 99999 }), 50);
        });
    fetchMsgs();
    supabase.from("messages").update({ read_by_admin: true }).eq("conversation_id", active).eq("is_admin", false).eq("read_by_admin", false).then(() => {});
    const ch = supabase.channel("admin-msgs-" + active).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${active}` },
      () => fetchMsgs(),
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active]);

  const send = async () => {
    if (!body.trim() || !active || !user) return;
    const text = body;
    setBody("");
    await supabase.from("messages").insert({
      conversation_id: active, sender_id: user.id, is_admin: true, body: text, read_by_admin: true,
    });
    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", active);
  };

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-semibold">{t("admin.messages")}</h1>
      <div className="grid gap-4 md:grid-cols-[280px_1fr] border rounded-lg overflow-hidden bg-card min-h-[600px]">
        <div className="border-e overflow-y-auto max-h-[600px]">
          {convs.length === 0 && <p className="p-4 text-sm text-muted-foreground">No messages.</p>}
          {convs.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={cn(
                "block w-full text-start p-4 border-b hover:bg-muted/40",
                active === c.id && "bg-muted",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm truncate">{c.profile?.full_name ?? c.profile?.email ?? "Unknown"}</div>
                {!!c.unread && <span className="bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">{c.unread}</span>}
              </div>
              <div className="text-xs text-muted-foreground truncate">{c.subject}</div>
              <div className="text-xs text-muted-foreground">{new Date(c.last_message_at).toLocaleDateString()}</div>
            </button>
          ))}
        </div>
        <div className="flex flex-col h-[600px]">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Select a conversation</div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {msgs.map((m) => (
                  <div key={m.id} className={cn("flex", m.is_admin ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[75%] rounded-lg px-3 py-2 text-sm", m.is_admin ? "bg-primary text-primary-foreground" : "bg-muted")}>
                      {m.body}
                      <div className="text-[10px] opacity-70 mt-1">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t p-3 flex gap-2">
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Reply..." className="flex-1 resize-none" />
                <Button onClick={send} disabled={!body.trim()}>{t("inbox.send")}</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
