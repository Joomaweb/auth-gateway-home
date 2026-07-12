import { createServerFn } from "@tanstack/react-start";

type Mode = "sandbox" | "production";
export type ChargeOutcome =
  | { ok: true; orderId: string; paymentId: string; status: "paid" | "pending" }
  | { ok: false; orderId: string; reason: "card_declined" | "verification_failed" | "cancelled" | "config_error" | "network_error" | "unknown"; message: string };

function squareApiBase(mode: Mode) {
  return mode === "production"
    ? "https://connect.squareup.com/v2"
    : "https://connect.squareupsandbox.com/v2";
}

async function getAdminSupabase() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function persistOrderUpdate(orderId: string, update: Record<string, unknown>) {
  try {
    const supabase = await getAdminSupabase();
    await supabase.from("orders").update(update).eq("id", orderId);
  } catch (err) {
    console.error("Square: order update failed:", err);
  }
}

type FailureReason = "card_declined" | "verification_failed" | "cancelled" | "config_error" | "network_error" | "unknown";

function classifyError(category: string | undefined, code: string | undefined): FailureReason {
  if (category === "PAYMENT_METHOD_ERROR") return "card_declined";
  if (code === "VERIFY_CVV_FAILURE" || code === "VERIFY_AVS_FAILURE") return "card_declined";
  if (code === "INSUFFICIENT_FUNDS" || code === "CARD_DECLINED" || code === "GENERIC_DECLINE") return "card_declined";
  if (code === "CARD_TOKEN_EXPIRED" || code === "CARD_TOKEN_USED") return "verification_failed";
  return "unknown";
}

export const chargeSquarePayment = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      orderId: string;
      sourceId: string;
      verificationToken?: string;
      amount: number;
      currency?: string;
      mode?: Mode;
    }) => input,
  )
  .handler(async ({ data }): Promise<ChargeOutcome> => {
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const locationId = process.env.SQUARE_LOCATION_ID;

    if (!accessToken || !locationId) {
      await persistOrderUpdate(data.orderId, { status: "failed", square_status: "CONFIG_ERROR" });
      return {
        ok: false,
        orderId: data.orderId,
        reason: "config_error",
        message: "Square is not configured on the server",
      };
    }

    const mode: Mode = data.mode ?? "production";
    const currency = (data.currency ?? "USD").toUpperCase();
    const amountMinor = Math.round(data.amount * 100);
    const idempotencyKey = `${data.orderId}-${Date.now()}`;

    const body = {
      idempotency_key: idempotencyKey,
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
          "Authorization": `Bearer ${accessToken}`,
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
    try { json = await res.json(); } catch { /* ignore */ }

    if (!res.ok) {
      const firstErr = json?.errors?.[0];
      const reason = classifyError(firstErr?.category, firstErr?.code);
      const message = firstErr?.detail ?? `Square error ${res.status}`;
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

    // FAILED or unknown
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
  });
