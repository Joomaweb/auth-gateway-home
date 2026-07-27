import { createServerFn } from "@tanstack/react-start";
import { processSquareCharge, type ChargeOutcome, type SquareMode } from "./square.server";

export type { ChargeOutcome };

export const chargeSquarePayment = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      orderId: string;
      sourceId: string;
      verificationToken?: string;
      amount: number;
      currency?: string;
      mode?: SquareMode;
      locationId?: string;
    }) => input,
  )
  .handler(async ({ data }): Promise<ChargeOutcome> => {
    return processSquareCharge(data);
  });
