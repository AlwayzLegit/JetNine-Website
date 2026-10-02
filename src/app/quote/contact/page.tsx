"use client";

import { StoreHydrationGate } from "@/components/quote/store-hydration";
import { ContactForm } from "@/components/quote/contact-form";

export default function ContactStep() {
  return (
    <StoreHydrationGate>
      <ContactForm />
    </StoreHydrationGate>
  );
}
