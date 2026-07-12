import { createFileRoute } from "@tanstack/react-router";
import type { Database } from "@/integrations/supabase/types";

type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];

// Square sends the signature in this header (HMAC-SHA256 of notificationUrl + body, base64).
const SIGNATURE_HEADER = "x-square-hmacsha256-signature";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

function constantTimeEqual(a: string, b: string): boolean {
  const max = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;

  for (let i = 0; i < max; i += 1) {
    const ac = i < a.length ? a.charCodeAt(i) : 0;
    const bc = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= ac ^ bc;
  }

  return mismatch === 0;
}

async function verifySquareSignature(
  signatureKey: string,
  notificationUrl: string,
  body: string,
  receivedSignature: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signatureKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(notificationUrl + body),
  );
  return constantTimeEqual(arrayBufferToBase64(signature), receivedSignature);
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

        if (!(await verifySquareSignature(signatureKey, notificationUrl, body, signature))) {
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

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const update: OrderUpdate = {
          square_payment_id: payment.id,
          square_status: status,
        };

        if (status === "COMPLETED" || status === "APPROVED") {
          update.status = "paid";
          update.paid_at = new Date().toISOString();
        } else if (status === "FAILED" || status === "CANCELED") {
          update.status = "cancelled";
        }

        const { error } = await supabaseAdmin
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
