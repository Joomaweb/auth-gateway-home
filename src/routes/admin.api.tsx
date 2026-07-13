import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  Check,
  Copy,
  KeyRound,
  Play,
  Radio,
  ShieldCheck,
  Smartphone,
  Square,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/admin/api")({
  component: AdminApi,
});

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  "";

function CopyBlock({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success("הועתק");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="space-y-1.5">
      {label && <div className="text-xs text-muted-foreground">{label}</div>}
      <div className="relative group">
        <pre
          dir="ltr"
          className="text-xs bg-muted/60 border rounded-md p-3 pe-12 overflow-x-auto font-mono text-foreground/90"
        >
          {value}
        </pre>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={copy}
          className="absolute end-1.5 top-1.5 h-7 w-7"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-gold" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

const TABLES = [
  { name: "products", desc: "מוצרים — קריאה ציבורית, כתיבה לאדמין בלבד" },
  { name: "product_variants", desc: "וריאנטים (מידה/צבע/מלאי) — אדמין" },
  { name: "categories", desc: "קטגוריות — אדמין" },
  { name: "orders", desc: "הזמנות — לקוח רואה את שלו, אדמין רואה הכל" },
  { name: "order_items", desc: "פריטים בהזמנה" },
  { name: "profiles", desc: "פרופילי לקוחות" },
  { name: "messages", desc: "הודעות צ'אט בזמן אמת" },
  { name: "store_settings", desc: "הגדרות חנות (היירו, באנרים)" },
  { name: "user_roles", desc: "תפקידים (admin/user) — קריאה בלבד" },
];

type LogEntry = {
  id: number;
  time: string;
  level: "info" | "success" | "error";
  text: string;
};

const REALTIME_TABLES = [
  { table: "products", label: "מוצרים" },
  { table: "product_variants", label: "וריאנטים ומלאי" },
  { table: "categories", label: "קטגוריות" },
  { table: "store_settings", label: "הגדרות / מדיה / תשלומים" },
  { table: "orders", label: "הזמנות" },
  { table: "order_items", label: "פריטי הזמנה" },
  { table: "profiles", label: "לקוחות" },
  { table: "conversations", label: "שיחות" },
  { table: "messages", label: "הודעות צ'אט" },
] as const;

type RealtimeTable = (typeof REALTIME_TABLES)[number]["table"];
type RealtimeStatus = "idle" | "connecting" | "live" | "error";
type RealtimePayload = {
  eventType?: string;
  new?: { id?: unknown } | null;
  old?: { id?: unknown } | null;
};
type AuthSession = { access_token?: string | null } | null;

function RealtimeTester() {
  const [statuses, setStatuses] = useState<Record<RealtimeTable, RealtimeStatus>>(() =>
    REALTIME_TABLES.reduce(
      (acc, { table }) => ({ ...acc, [table]: "idle" }),
      {} as Record<RealtimeTable, RealtimeStatus>,
    ),
  );
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const channelsRef = useRef<Partial<Record<RealtimeTable, ReturnType<typeof supabase.channel>>>>(
    {},
  );
  const idRef = useRef(0);

  const setTableStatus = (table: RealtimeTable, status: RealtimeStatus) => {
    setStatuses((prev) => ({ ...prev, [table]: status }));
  };

  const log = (level: LogEntry["level"], text: string) => {
    idRef.current += 1;
    const entry: LogEntry = {
      id: idRef.current,
      time: new Date().toLocaleTimeString("he-IL"),
      level,
      text,
    };
    setLogs((prev) => [entry, ...prev].slice(0, 80));
  };

  const subscribe = (table: RealtimeTable) => {
    if (channelsRef.current[table]) {
      log("info", `כבר מחובר ל-${table}`);
      return;
    }
    setTableStatus(table, "connecting");
    log("info", `מתחבר ל-Realtime · ${table}…`);
    const channel = supabase
      .channel(`rt-${table}-${Date.now()}`)
      .on("postgres_changes" as never, { event: "*", schema: "public", table }, ((
        payload: RealtimePayload,
      ) => {
        const row = payload.new ?? payload.old ?? {};
        log(
          "success",
          `${table} · ${payload.eventType} · ${row.id ? "#" + String(row.id).slice(0, 8) : ""}`,
        );
      }) as never)
      .subscribe((status: string, err?: Error) => {
        if (status === "SUBSCRIBED") {
          setTableStatus(table, "live");
          log("success", `מחובר בהצלחה ל-${table} ✓`);
          toast.success(`Realtime · ${table} פעיל`);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setTableStatus(table, "error");
          log("error", `שגיאת חיבור ל-${table}: ${err?.message || status}`);
          toast.error(`כשל בחיבור ל-${table}`);
        } else if (status === "CLOSED") {
          setTableStatus(table, "idle");
          log("info", `החיבור ל-${table} נסגר`);
        }
      });
    channelsRef.current[table] = channel;
  };

  const unsubscribe = (table: RealtimeTable) => {
    const ch = channelsRef.current[table];
    if (ch) {
      supabase.removeChannel(ch);
      channelsRef.current[table] = undefined;
      setTableStatus(table, "idle");
      log("info", `נותק מ-${table}`);
    }
  };

  useEffect(() => {
    const channels = channelsRef.current;
    return () => {
      Object.values(channels).forEach((c) => c && supabase.removeChannel(c));
    };
  }, []);

  const StatusDot = ({ s }: { s: RealtimeStatus }) => {
    const map = {
      idle: "bg-muted-foreground/40",
      connecting: "bg-amber-500 animate-pulse",
      live: "bg-emerald-500 animate-pulse",
      error: "bg-destructive",
    } as const;
    const txt = { idle: "לא פעיל", connecting: "מתחבר…", live: "פעיל", error: "שגיאה" }[s];
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className={`h-2 w-2 rounded-full ${map[s]}`} />
        <span className="text-muted-foreground">{txt}</span>
      </span>
    );
  };

  const Row = ({
    table,
    label,
    status,
  }: {
    table: RealtimeTable;
    label: string;
    status: RealtimeStatus;
  }) => (
    <div className="flex items-center justify-between gap-3 p-3 rounded-md border bg-muted/30">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-md bg-gradient-gold flex items-center justify-center text-gold-foreground">
          <Activity className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-medium">{label}</div>
          <code className="text-[11px] text-muted-foreground">public.{table}</code>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <StatusDot s={status} />
        {status === "live" || status === "connecting" ? (
          <Button size="sm" variant="outline" onClick={() => unsubscribe(table)}>
            <Square className="h-3.5 w-3.5 me-1.5" /> נתק
          </Button>
        ) : (
          <Button size="sm" onClick={() => subscribe(table)}>
            <Play className="h-3.5 w-3.5 me-1.5" /> חבר
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Card className="shadow-elegant border-gold/30 overflow-hidden">
      <CardHeader className="bg-gradient-to-l from-muted/40 to-transparent">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-gradient-gold flex items-center justify-center text-gold-foreground shadow-soft">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">בדיקת Realtime חיה</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Subscribe לכל טבלאות החנות הקריטיות — לוגים בזמן אמת
              </p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setLogs([])}>
            <Trash2 className="h-3.5 w-3.5 me-1.5" /> נקה לוג
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2.5 md:grid-cols-2">
          {REALTIME_TABLES.map(({ table, label }) => (
            <Row key={table} table={table} label={label} status={statuses[table]} />
          ))}
        </div>

        <div
          dir="ltr"
          className="rounded-md border bg-foreground/[0.97] text-background/95 font-mono text-[11.5px] leading-relaxed h-64 overflow-auto p-3"
        >
          {logs.length === 0 ? (
            <div className="text-background/50 text-center py-10" dir="rtl">
              לחצו "חבר" כדי להתחיל. כל אירוע ב-DB יופיע כאן בזמן אמת.
            </div>
          ) : (
            logs.map((l) => (
              <div key={l.id} className="flex gap-2">
                <span className="text-background/40 shrink-0">{l.time}</span>
                <span
                  className={
                    l.level === "success"
                      ? "text-emerald-400"
                      : l.level === "error"
                        ? "text-rose-400"
                        : "text-amber-300"
                  }
                >
                  {l.level === "success" ? "✓" : l.level === "error" ? "✗" : "•"}
                </span>
                <span className="text-background/90" dir="auto">
                  {l.text}
                </span>
              </div>
            ))
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          טיפ: פתחו טאב נוסף, צרו הזמנה או שלחו הודעה — האירוע יופיע כאן מיידית. אם יש שגיאה, ודאו
          ש-Realtime מופעל לטבלה ב-Supabase ושלמשתמש שלכם תפקיד <code>admin</code>.
        </p>
      </CardContent>
    </Card>
  );
}

function AdminApi() {
  const { user, session } = useAuth() as ReturnType<typeof useAuth> & { session?: AuthSession };
  const accessToken = session?.access_token ?? "";

  const reactNativeSnippet = `// React Native / Expo
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  '${SUPABASE_URL}',
  '${SUPABASE_ANON_KEY.slice(0, 24)}...', // VITE_SUPABASE_ANON_KEY
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// התחברות כאדמין:
await supabase.auth.signInWithPassword({
  email: 'admin@example.com',
  password: '••••••',
});

// שליפת הזמנות:
const { data } = await supabase
  .from('orders')
  .select('*, order_items(*)')
  .order('created_at', { ascending: false });`;

  const realtimeSnippet = `// האזנה להזמנות חדשות בזמן אמת
const channel = supabase
  .channel('orders-feed')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'orders' },
    (payload) => {
      console.log('שינוי בהזמנה:', payload);
      // payload.new — הזמנה חדשה / מעודכנת
      // payload.eventType — INSERT | UPDATE | DELETE
    },
  )
  .subscribe();

// הודעות חדשות:
supabase
  .channel('messages-feed')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'messages' },
    (p) => notifyNewMessage(p.new))
  .subscribe();`;

  const restSnippet = `# REST API ישיר (curl)
# כל שאילתת SELECT / INSERT / UPDATE / DELETE זמינה תחת:
#   ${SUPABASE_URL}/rest/v1/<table>

curl '${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.desc' \\
  -H "apikey: $SUPABASE_ANON_KEY" \\
  -H "Authorization: Bearer $USER_ACCESS_TOKEN"`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-semibold">API & חיבור אפליקציה</h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
            כל מה שצריך כדי לחבר אפליקציה חיצונית (React Native / Flutter / Web) לחנות בזמן אמת —
            כולל הזמנות, מוצרים, צ'אט והרשאות אדמין מלאות.
          </p>
        </div>
        <Badge className="bg-gradient-gold text-gold-foreground border-0 shadow-soft">
          <ShieldCheck className="h-3.5 w-3.5 me-1" /> מאובטח · RLS
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { icon: KeyRound, title: "אימות", text: "התחברות במייל/סיסמה. ה-JWT הוא ה-API token." },
          { icon: Radio, title: "בזמן אמת", text: "Supabase Realtime — push להזמנות והודעות." },
          { icon: Smartphone, title: "Mobile-ready", text: "אותו לקוח Supabase פועל ב-RN/Expo." },
        ].map((c) => (
          <Card key={c.title} className="border-gold/30 shadow-soft">
            <CardHeader className="pb-2">
              <div className="h-9 w-9 rounded-md bg-gradient-gold flex items-center justify-center text-gold-foreground">
                <c.icon className="h-4.5 w-4.5" />
              </div>
              <CardTitle className="text-base mt-2">{c.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{c.text}</CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-elegant border-gold/20">
        <CardHeader>
          <CardTitle className="text-lg">פרטי חיבור</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CopyBlock label="Supabase URL" value={SUPABASE_URL} />
          <CopyBlock label="Anon Key (publishable)" value={SUPABASE_ANON_KEY} />
          {user && accessToken && (
            <CopyBlock
              label={`ה-JWT הנוכחי שלך (אדמין: ${user.email}) — לבדיקה ב-Postman`}
              value={accessToken}
            />
          )}
          <p className="text-xs text-muted-foreground leading-relaxed">
            ה-Anon Key פומבי ובטוח לשמור באפליקציה. ההרשאות נשלטות על ידי{" "}
            <span className="text-gold font-medium">RLS + user_roles</span>: לאחר התחברות עם משתמש שהוא{" "}
            <code className="text-foreground">admin</code> ב-<code>user_roles</code>, יש גישה מלאה לכל
            הטבלאות.
          </p>
        </CardContent>
      </Card>

      <RealtimeTester />

      <Tabs defaultValue="rn" className="w-full">
        <TabsList className="bg-muted/60">
          <TabsTrigger value="rn">React Native</TabsTrigger>
          <TabsTrigger value="rt">Realtime</TabsTrigger>
          <TabsTrigger value="rest">REST</TabsTrigger>
        </TabsList>
        <TabsContent value="rn" className="mt-4">
          <CopyBlock value={reactNativeSnippet} />
        </TabsContent>
        <TabsContent value="rt" className="mt-4">
          <CopyBlock value={realtimeSnippet} />
        </TabsContent>
        <TabsContent value="rest" className="mt-4">
          <CopyBlock value={restSnippet} />
        </TabsContent>
      </Tabs>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">טבלאות זמינות</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="p-3 text-start font-medium">טבלה</th>
                  <th className="p-3 text-start font-medium">תיאור</th>
                  <th className="p-3 text-start font-medium">Realtime</th>
                </tr>
              </thead>
              <tbody>
                {TABLES.map((t) => (
                  <tr key={t.name} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs text-gold">{t.name}</td>
                    <td className="p-3 text-muted-foreground">{t.desc}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="border-gold/40 text-gold">
                        ✓
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft border-gold/20">
        <CardHeader>
          <CardTitle className="text-lg">הוספת אדמינים נוספים</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            כדי להעניק לאפליקציה הצידית של המוכר/הסוכן גישת אדמין מלאה, הרץ את הפקודה הבאה ב-SQL
            Editor של Supabase לאחר שהמשתמש נרשם:
          </p>
          <CopyBlock
            value={`INSERT INTO public.user_roles (user_id, role)
VALUES ('<USER_UUID>', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
