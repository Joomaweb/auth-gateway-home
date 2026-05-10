import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";

// Square sends the signature in this header (HMAC-SHA256 of notificationUrl + body, base64).
const SIGNATURE_HEADER = "x-square-hmacsha256-signature";

function verifySquareSignature(
  signatureKey: string,
  notificationUrl: string,
  body: string,
  receivedSignature: string,
): boolean {
  const hmac = createHmac("sha256", signatureKey);
  hmac.update(notificationUrl + body);
  const expected = hmac.digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(receivedSignature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function getSupabaseAdmin() {
  const url = "https://supabase.mako-chat.com";
  const serviceKey = process.env.MAKO_SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("MAKO_SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const Route = createFileRoute("/api/public/square-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
        if (!signatureKey) {
          return new Response("Webhook not configured", { status: 500 });
        }

        const signature = request.headers.get(SIGNATURE_HEADER);
        if (!signature) {
          return new Response("Missing signature", { status: 401 });
        }

        const body = await request.text();
        const notificationUrl = `${new URL(request.url).origin}/api/public/square-webhook`;

        if (!verifySquareSignature(signatureKey, notificationUrl, body, signature)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const eventType: string = payload?.type ?? "";
        const payment = payload?.data?.object?.payment;

        if (!payment || (eventType !== "payment.created" && eventType !== "payment.updated")) {
          return new Response("ignored", { status: 200 });
        }

        // Square reference_id is what we set when creating the payment — store our order_id there.
        const orderId: string | undefined = payment.reference_id ?? payment.order_id;
        const status: string = payment.status ?? "";

        if (!orderId) {
          return new Response("no reference", { status: 200 });
        }

        const supabase = getSupabaseAdmin();
        const update: Record<string, unknown> = {
          square_payment_id: payment.id,
          square_status: status,
        };

        if (status === "COMPLETED" || status === "APPROVED") {
          update.status = "paid";
          update.paid_at = new Date().toISOString();
        } else if (status === "FAILED" || status === "CANCELED") {
          update.status = "cancelled";
        }

        const { error } = await supabase
          .from("orders")
          .update(update)
          .eq("id", orderId);

        if (error) {
          console.error("Square webhook DB update failed:", error);
          return new Response("DB error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
