import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { toast } from "sonner";

type Props = {
  clientId: string;
  mode: "sandbox" | "live";
  amount: number;
  currency?: string;
  disabled?: boolean;
  onApproved: (paypalOrderId: string, captureId: string) => Promise<void> | void;
};

/**
 * Renders PayPal Smart Buttons. PayPal Smart Buttons automatically display:
 *  - The PayPal button (login/PayPal balance)
 *  - A separate "Debit or Credit Card" button (guest card checkout)
 * The customer chooses which to use.
 */
export function PayPalCheckout({
  clientId,
  mode,
  amount,
  currency = "USD",
  disabled,
  onApproved,
}: Props) {
  if (!clientId) {
    return (
      <div className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/30">
        PayPal is not configured. Ask the admin to add a Client ID in Settings.
      </div>
    );
  }

  return (
    <div className={disabled ? "pointer-events-none opacity-50" : ""}>
      <PayPalScriptProvider
        options={{
          clientId,
          currency,
          intent: "capture",
          components: "buttons",
          ...(mode === "sandbox" ? { "enable-funding": "card" } : {}),
        }}
      >
        <PayPalButtons
          style={{ layout: "vertical", shape: "rect", label: "pay" }}
          disabled={disabled || amount <= 0}
          forceReRender={[amount, currency]}
          createOrder={(_data, actions) =>
            actions.order.create({
              intent: "CAPTURE",
              purchase_units: [
                {
                  amount: {
                    currency_code: currency,
                    value: amount.toFixed(2),
                  },
                },
              ],
            })
          }
          onApprove={async (_data, actions) => {
            try {
              const details = await actions.order!.capture();
              const captureId =
                details?.purchase_units?.[0]?.payments?.captures?.[0]?.id ||
                details?.id ||
                "";
              await onApproved(details?.id || "", captureId);
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Payment failed";
              toast.error(msg);
            }
          }}
          onError={(err) => {
            const msg = err instanceof Error ? err.message : "PayPal error";
            toast.error(msg);
          }}
          onCancel={() => toast.info("Payment cancelled")}
        />
      </PayPalScriptProvider>
    </div>
  );
}
