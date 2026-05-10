import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, KeyRound, Radio, ShieldCheck, Smartphone, Play, Square, Trash2, Activity } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/admin/api")({
  component: AdminApi,
});

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "https://supabase.mako-chat.com";
const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";

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

function AdminApi() {
  const { user, session } = useAuth() as ReturnType<typeof useAuth> & { session: any };
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
            כדי להעניק לאפליקציה הצידית של המוכר/הסוכן גישת אדמין מלאה, הרץ את הפקודה הבאה ב-SQL Editor של
            Supabase לאחר שהמשתמש נרשם:
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
