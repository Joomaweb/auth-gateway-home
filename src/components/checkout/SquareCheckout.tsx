import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Mode = "sandbox" | "production";

type Props = {
  applicationId: string;
  locationId: string;
  mode: Mode;
  amount: number;
  currency?: string;
  disabled?: boolean;
  onTokenized: (sourceId: string, verificationToken?: string) => Promise<void> | void;
};

declare global {
  interface Window {
    Square?: any;
  }
}

const SDK_URLS: Record<Mode, string> = {
  sandbox: "https://sandbox.web.squarecdn.com/v1/square.js",
  production: "https://web.squarecdn.com/v1/square.js",
};

function loadSquareSdk(mode: Mode): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Square) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-square-sdk]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Square SDK")));
      return;
    }
    const s = document.createElement("script");
    s.src = SDK_URLS[mode];
    s.async = true;
    s.dataset.squareSdk = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Square SDK"));
    document.head.appendChild(s);
  });
}

export function SquareCheckout({
  applicationId,
  locationId,
  mode,
  amount,
  currency = "USD",
  disabled,
  onTokenized,
}: Props) {
  const cardContainerRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<any>(null);
  const paymentsRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!applicationId || !locationId) return;

    (async () => {
      try {
        await loadSquareSdk(mode);
        if (cancelled || !window.Square) return;
        const payments = window.Square.payments(applicationId, locationId);
        paymentsRef.current = payments;
        const card = await payments.card();
        if (cancelled) return;
        await card.attach(cardContainerRef.current!);
        cardRef.current = card;
        setReady(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Square init failed";
        toast.error(msg);
      }
    })();

    return () => {
      cancelled = true;
      try { cardRef.current?.destroy?.(); } catch {}
      cardRef.current = null;
      paymentsRef.current = null;
    };
  }, [applicationId, locationId, mode]);

  const handlePay = async () => {
    if (!cardRef.current || !paymentsRef.current) return;
    setBusy(true);
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== "OK") {
        const detail = result.errors?.[0]?.message ?? "Card tokenization failed";
        throw new Error(detail);
      }

      // Optional 3DS / SCA buyer verification
      let verificationToken: string | undefined;
      try {
        const verify = await paymentsRef.current.verifyBuyer(result.token, {
          amount: amount.toFixed(2),
          billingContact: {},
          currencyCode: currency,
          intent: "CHARGE",
        });
        verificationToken = verify?.token;
      } catch {
        // verifyBuyer is optional; some accounts don't support it
      }

      await onTokenized(result.token, verificationToken);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  };

  if (!applicationId || !locationId) {
    return (
      <div className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/30">
        Square is not configured. Ask the admin to add Application ID and Location ID in Settings.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={cardContainerRef}
        className="border rounded-md p-3 bg-background min-h-[56px]"
      />
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={disabled || busy || !ready || amount <= 0}
        onClick={handlePay}
      >
        {busy ? "Processing..." : `Pay ${currency} ${amount.toFixed(2)}`}
      </Button>
    </div>
  );
}
