import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

type Mode = "sandbox" | "production";

function squareApiBase(mode: Mode) {
  return mode === "production"
    ? "https://connect.squareup.com/v2"
    : "https://connect.squareupsandbox.com/v2";
}

function getAdminSupabase() {
  const key = process.env.MAKO_SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("MAKO_SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient("https://supabase.mako-chat.com", key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const chargeSquarePayment = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      orderId: string;
      sourceId: string;
      verificationToken?: string;
      amount: number; // in major units (e.g. 19.99)
      currency?: string;
      mode?: Mode;
    }) => input,
  )
  .handler(async ({ data }) => {
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const locationId = process.env.SQUARE_LOCATION_ID;
    if (!accessToken) throw new Error("SQUARE_ACCESS_TOKEN not set");
    if (!locationId) throw new Error("SQUARE_LOCATION_ID not set");

    const mode: Mode = data.mode ?? "production";
    const currency = (data.currency ?? "USD").toUpperCase();
    const amountMinor = Math.round(data.amount * 100);
    const idempotencyKey = `${data.orderId}-${Date.now()}`;

    const body = {
      idempotency_key: idempotencyKey,
      source_id: data.sourceId,
      verification_token: data.verificationToken,
      location_id: locationId,
      reference_id: data.orderId, // critical for webhook reconciliation
      amount_money: { amount: amountMinor, currency },
      autocomplete: true,
    };

    const res = await fetch(`${squareApiBase(mode)}/payments`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-10-17",
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as any;
    if (!res.ok) {
      const msg = json?.errors?.[0]?.detail ?? `Square error ${res.status}`;
      return { ok: false as const, error: msg };
    }

    const payment = json.payment;
    const status: string = payment?.status ?? "";
    const paymentId: string = payment?.id ?? "";

    // Update order immediately (webhook will also confirm asynchronously).
    try {
      const supabase = getAdminSupabase();
      const update: Record<string, unknown> = {
        square_payment_id: paymentId,
        square_status: status,
      };
      if (status === "COMPLETED" || status === "APPROVED") {
        update.status = "paid";
        update.paid_at = new Date().toISOString();
      }
      await supabase.from("orders").update(update).eq("id", data.orderId);
    } catch (err) {
      console.error("Square: failed to update order:", err);
    }

    return { ok: true as const, paymentId, status };
  });
