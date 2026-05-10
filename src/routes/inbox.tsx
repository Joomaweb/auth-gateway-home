import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inbox")({
  component: InboxPage,
});

type Conv = { id: string; subject: string; last_message_at: string };
type Msg = { id: string; body: string; is_admin: boolean; created_at: string; sender_id: string };

function InboxPage() {
  const { t } = useT();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const loadConvs = () => {
    if (!user) return;
    supabase
      .from("conversations")
      .select("id,subject,last_message_at")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false })
      .then(({ data }) => {
        const list = (data ?? []) as Conv[];
        setConvs(list);
        if (!active && list.length > 0) setActive(list[0].id);
      });
  };

  useEffect(loadConvs, [user]);

  useEffect(() => {
    if (!active) return;
    const load = () =>
      supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", active)
        .order("created_at", { ascending: true })
        .then(({ data }) => {
          setMsgs((data ?? []) as Msg[]);
          setTimeout(() => scrollRef.current?.scrollTo({ top: 99999 }), 50);
        });
    load();
    // mark admin messages as read
    supabase
      .from("messages")
      .update({ read_by_user: true })
      .eq("conversation_id", active)
      .eq("is_admin", true)
      .eq("read_by_user", false)
      .then(() => {});
    const ch = supabase
      .channel("conv-" + active)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${active}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active]);

  const send = async () => {
    if (!body.trim() || !active || !user) return;
    const text = body;
    setBody("");
    await supabase.from("messages").insert({
      conversation_id: active,
      sender_id: user.id,
      is_admin: false,
      body: text,
      read_by_user: true,
    });
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", active);
  };

  if (!user) return null;

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-semibold mb-6">{t("inbox.title")}</h1>
        {convs.length === 0 ? (
          <div className="border rounded-lg p-12 text-center text-muted-foreground">{t("inbox.empty")}</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[260px_1fr] border rounded-lg overflow-hidden bg-card min-h-[500px]">
            <div className="border-e">
              {convs.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActive(c.id)}
                  className={cn(
                    "block w-full text-start p-4 border-b hover:bg-muted/40",
                    active === c.id && "bg-muted",
                  )}
                >
                  <div className="font-medium text-sm truncate">{c.subject}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(c.last_message_at).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex flex-col h-[500px]">
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {msgs.map((m) => (
                  <div key={m.id} className={cn("flex", m.is_admin ? "justify-start" : "justify-end")}>
                    <div className={cn(
                      "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                      m.is_admin ? "bg-muted" : "bg-primary text-primary-foreground",
                    )}>
                      {m.body}
                      <div className="text-[10px] opacity-70 mt-1">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t p-3 flex gap-2">
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t("inbox.placeholder")}
                  rows={2}
                  className="flex-1 resize-none"
                />
                <Button onClick={send} disabled={!body.trim()}>{t("inbox.send")}</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
