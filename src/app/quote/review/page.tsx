"use client";

import { StoreHydrationGate } from "@/components/quote/store-hydration";
import { ReviewStep } from "@/components/quote/review-step";

export default function ReviewPage() {
  return (
    <StoreHydrationGate>
      <ReviewStep />
    </StoreHydrationGate>
  );
}
