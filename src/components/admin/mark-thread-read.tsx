"use client";

import { useEffect } from "react";
import { markThreadRead, type ThreadSubjectType } from "@/app/admin/thread-actions";

/**
 * Fire-and-forget: marks the thread's inbound messages read when a
 * dispatcher opens the request, trip or Messages conversation. Renders
 * nothing.
 */
export function MarkThreadRead({
  subjectType,
  subjectId,
}: {
  subjectType: ThreadSubjectType;
  subjectId: string;
}) {
  useEffect(() => {
    markThreadRead(subjectType, subjectId).catch(() => {
      // Best-effort — an unread dot surviving one page view is harmless.
    });
  }, [subjectType, subjectId]);
  return null;
}
