import type { Database } from "@/integrations/supabase/types";
import { createClient } from "@supabase/supabase-js";

type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];

export type SquareMode = "sandbox" | "production";

export type ChargeOutcome =
  | { ok: true; orderId: string; paymentId: string; status: "paid" | "pending" }
  | {
      ok: false;
      orderId: string;
      reason: "card_declined" | "verification_failed" | "cancelled" | "config_error" | "network_error" | "unknown";
      message: string;
    };

type ChargeInput = {
  orderId: string;
  sourceId: string;
  verificationToken?: string;
  amount?: number;
  currency?: string;
  mode?: SquareMode;
  locationId?: string;
};

type FailureReason = "card_declined" | "verification_failed" | "cancelled" | "config_error" | "network_error" | "unknown";

type SupabaseClient = ReturnType<typeof createClient<Database>>;

let cachedClient: SupabaseClient | null = null;

function cleanEnv(value: string | undefined): string {
  return (value ?? "").trim();
}

function firstEnv(names: string[]): { value: string; name: string } {
  for (const name of names) {
    const value = cleanEnv(process.env[name]);
    if (value) return { value, name };
  }
  return { value: "", name: names[0] ?? "" };
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function squareApiBase(mode: SquareMode) {
  return mode === "production"
    ? "https://connect.squareup.com/v2"
    : "https://connect.squareupsandbox.com/v2";
}

function getSupabase(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const supabaseUrl = firstEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]).value;
  const anonKey = firstEnv([
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
    "VITE_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "MAKO_SUPABASE_SERVICE_ROLE_KEY",
  ]).value;

  if (!supabaseUrl || !anonKey) {
    const missing = [
      ...(!supabaseUrl ? ["SUPABASE_URL"] : []),
      ...(!anonKey ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(`Backend configuration is missing: ${missing.join(", ")}`);
  }

  cachedClient = createClient<Database>(supabaseUrl, anonKey, {
    global: { fetch: createSupabaseFetch(anonKey) },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}

async function persistOrderUpdate(orderId: string, update: OrderUpdate) {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.rpc("payment_update_order", {
      _order_id: orderId,
      _status: (update.status as string | undefined) ?? null,
      _square_status: (update.square_status as string | undefined) ?? null,
      _square_payment_id: (update.square_payment_id as string | undefined) ?? null,
      _paid_at: (update.paid_at as string | undefined) ?? null,
    } as never);
    if (error) console.error("Square: order update failed:", error.message);
  } catch (err) {
    console.error("Square: order update failed:", err);
  }
}

function classifyError(category: string | undefined, code: string | undefined): FailureReason {
  if (category === "PAYMENT_METHOD_ERROR") return "card_declined";
  if (code === "VERIFY_CVV_FAILURE" || code === "VERIFY_AVS_FAILURE") return "card_declined";
  if (code === "INSUFFICIENT_FUNDS" || code === "CARD_DECLINED" || code === "GENERIC_DECLINE") return "card_declined";
  if (code === "CARD_TOKEN_EXPIRED" || code === "CARD_TOKEN_USED") return "verification_failed";
  return "unknown";
}

async function getAuthoritativeOrderTotal(orderId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("payment_get_order", { _order_id: orderId } as never);

  if (error || !data) {
    throw new Error(error?.message ?? "Order not found");
  }

  const row = data as Record<string, unknown>;
  return {
    total: Number(row.total ?? 0),
    status: String(row.status ?? ""),
    paymentId: row.square_payment_id ? String(row.square_payment_id) : "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function getSquareSettings() {
  let square: Record<string, unknown> = {};
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("payment_get_square_settings" as never);
    if (error) {
      console.error("Square: settings lookup failed:", error.message);
    } else if (isRecord(data)) {
      square = data;
    }
  } catch (err) {
    console.error("Square: settings lookup failed:", err instanceof Error ? err.message : err);
  }

  const envMode = cleanEnv(process.env.SQUARE_MODE).toLowerCase();
  const mode: SquareMode = envMode === "production" ? "production"
    : envMode === "sandbox" ? "sandbox"
    : square.mode === "production" ? "production"
    : square.mode === "sandbox" ? "sandbox"
    : "production";

  const tokenEnv = firstEnv([
    "SQUARE_ACCESS_TOKEN",
    "SQUARE_TOKEN",
    "SQUARE_KEY_TOKEN",
    "SQUARE_API_KEY",
    "SQUARE_AUTH_TOKEN",
    "KEY_TOKEN",
    "KEY TOKEN",
    "ACCESS_TOKEN",
    "SQUARE_PRODUCTION_ACCESS_TOKEN",
    "SQUARE_SANDBOX_ACCESS_TOKEN",
  ]);

  return {
    enabled: Boolean(square.enabled) || Boolean(tokenEnv.value),
    locationId: typeof square.location_id === "string" ? square.location_id.trim() : "",
    mode,
  };
}

export async function processSquareCharge(data: ChargeInput): Promise<ChargeOutcome> {
  const tokenEnv = firstEnv([
    "SQUARE_ACCESS_TOKEN",
    "SQUARE_TOKEN",
    "SQUARE_KEY_TOKEN",
    "SQUARE_API_KEY",
    "SQUARE_AUTH_TOKEN",
    "KEY_TOKEN",
    "KEY TOKEN",
    "ACCESS_TOKEN",
    "SQUARE_PRODUCTION_ACCESS_TOKEN",
    "SQUARE_SANDBOX_ACCESS_TOKEN",
  ]);
  const accessToken = tokenEnv.value;
  const squareSettings = await getSquareSettings();
  const locationEnv = firstEnv(["SQUARE_LOCATION_ID", "SQUARE_LOCATION", "LOCATION_ID"]);
  const locationId = (locationEnv.value || squareSettings.locationId || data.locationId || "").trim();

  if (!squareSettings.enabled || !accessToken || !locationId) {
    const missing = [
      ...(!squareSettings.enabled ? ["SQUARE_DISABLED"] : []),
      ...(!accessToken ? ["SQUARE_ACCESS_TOKEN"] : []),
      ...(!locationId ? ["SQUARE_LOCATION_ID"] : []),
    ];
    console.error("Square: payment configuration missing", {
      missing,
      hasDatabaseLocationId: Boolean(squareSettings.locationId),
      hasClientLocationId: Boolean(data.locationId),
      mode: squareSettings.mode,
    });
    await persistOrderUpdate(data.orderId, { status: "failed", square_status: `CONFIG_ERROR:${missing.join(",")}` });
    return {
      ok: false,
      orderId: data.orderId,
      reason: "config_error",
      message: missing.includes("SQUARE_ACCESS_TOKEN")
        ? "Payment server token is missing"
        : "Square payment settings are missing on the server",
    };
  }

  let orderTotal = 0;
  try {
    const order = await getAuthoritativeOrderTotal(data.orderId);
    if (order.status === "paid" && order.paymentId) {
      return { ok: true, orderId: data.orderId, paymentId: order.paymentId, status: "paid" };
    }
    orderTotal = order.total;
  } catch (err) {
    await persistOrderUpdate(data.orderId, { status: "failed", square_status: "ORDER_LOOKUP_FAILED" });
    return {
      ok: false,
      orderId: data.orderId,
      reason: "config_error",
      message: err instanceof Error ? err.message : "Order lookup failed",
    };
  }

  const mode: SquareMode = squareSettings.mode ?? data.mode ?? "production";
  const currency = (data.currency ?? "USD").toUpperCase();
  const amountToCharge = Number.isFinite(orderTotal) && orderTotal > 0 ? orderTotal : Number(data.amount ?? 0);
  const amountMinor = Math.round(amountToCharge * 100);

  if (amountMinor <= 0) {
    await persistOrderUpdate(data.orderId, { status: "failed", square_status: "INVALID_AMOUNT" });
    return {
      ok: false,
      orderId: data.orderId,
      reason: "config_error",
      message: "Invalid payment amount",
    };
  }

  const body = {
    idempotency_key: crypto.randomUUID(),
    source_id: data.sourceId,
    verification_token: data.verificationToken,
    location_id: locationId,
    reference_id: data.orderId,
    amount_money: { amount: amountMinor, currency },
    autocomplete: true,
  };

  let res: Response;
  try {
    res = await fetch(`${squareApiBase(mode)}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-10-17",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    await persistOrderUpdate(data.orderId, { status: "failed", square_status: "NETWORK_ERROR" });
    return {
      ok: false,
      orderId: data.orderId,
      reason: "network_error",
      message: err instanceof Error ? err.message : "Network error contacting Square",
    };
  }

  let json: any = {};
  try {
    json = await res.json();
  } catch {
    // ignore non-JSON Square failures
  }

  if (!res.ok) {
    const firstErr = json?.errors?.[0];
    const reason = classifyError(firstErr?.category, firstErr?.code);
    const message = firstErr?.detail ?? `Square error ${res.status}`;
    console.error("Square payment failed", {
      status: res.status,
      code: firstErr?.code,
      category: firstErr?.category,
      orderId: data.orderId,
    });
    await persistOrderUpdate(data.orderId, {
      status: "failed",
      square_status: firstErr?.code ?? `HTTP_${res.status}`,
    });
    return { ok: false, orderId: data.orderId, reason, message };
  }

  const payment = json.payment ?? {};
  const status: string = payment.status ?? "";
  const paymentId: string = payment.id ?? "";

  if (status === "COMPLETED" || status === "APPROVED") {
    await persistOrderUpdate(data.orderId, {
      status: "paid",
      paid_at: new Date().toISOString(),
      square_payment_id: paymentId,
      square_status: status,
    });
    return { ok: true, orderId: data.orderId, paymentId, status: "paid" };
  }

  if (status === "PENDING") {
    await persistOrderUpdate(data.orderId, {
      status: "pending",
      square_payment_id: paymentId,
      square_status: status,
    });
    return { ok: true, orderId: data.orderId, paymentId, status: "pending" };
  }

  if (status === "CANCELED") {
    await persistOrderUpdate(data.orderId, {
      status: "cancelled",
      square_payment_id: paymentId,
      square_status: status,
    });
    return {
      ok: false,
      orderId: data.orderId,
      reason: "cancelled",
      message: "Payment was cancelled",
    };
  }

  await persistOrderUpdate(data.orderId, {
    status: "failed",
    square_payment_id: paymentId,
    square_status: status || "FAILED",
  });
  return {
    ok: false,
    orderId: data.orderId,
    reason: "card_declined",
    message: "Card declined or payment failed",
  };
}