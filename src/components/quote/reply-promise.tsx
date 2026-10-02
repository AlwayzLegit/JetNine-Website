"use client";

import { createContext, useContext } from "react";
import { replyPromiseWords } from "@/lib/desk-status";

/**
 * The desk's reply-time promise (Settings › Notifications), read once by
 * the quote layout on the server and handed to the client steps through
 * context — the step pages are client components with no server parent
 * of their own. Defaults to 30 minutes outside the provider.
 */
const ReplyPromiseContext = createContext<number>(30);

export function ReplyPromiseProvider({
  minutes,
  children,
}: {
  minutes: number;
  children: React.ReactNode;
}) {
  return <ReplyPromiseContext.Provider value={minutes}>{children}</ReplyPromiseContext.Provider>;
}

/** Minutes the desk promises for a first reply (15, 30 or 60). */
export function useReplyPromiseMinutes(): number {
  return useContext(ReplyPromiseContext);
}

/** "within 30 minutes" / "within an hour". */
export function useReplyPromiseWords(): string {
  return replyPromiseWords(useContext(ReplyPromiseContext));
}
