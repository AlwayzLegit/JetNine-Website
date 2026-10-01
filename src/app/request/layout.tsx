import type { Metadata } from "next";
import { SkipLink } from "@/components/skip-link";

// Guest status pages are keyed by an unguessable token: never indexed,
// never followed.
export const metadata: Metadata = {
  title: "Your request",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function RequestLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      {children}
    </>
  );
}
