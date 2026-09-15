"use client";

import { useEffect } from "react";
import { markThreadRead } from "@/app/admin/thread-actions";

/**
 * Fire-and-forget: marks the thread's inbound messages read when a
 * dispatcher opens the sheet. Renders nothing.
 */
export function MarkThreadRead({
  subjectType,
  subjectId,
}: {
  subjectType: "quote" | "trip";
  subjectId: string;
}) {
  useEffect(() => {
    markThreadRead(subjectType, subjectId).catch(() => {
      // Best-effort — an unread pill surviving one page view is harmless.
    });
  }, [subjectType, subjectId]);
  return null;
}
