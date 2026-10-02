"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

// Settings › Connections › Email › "Send a test". Owner-only. Emails the
// signed-in owner through the same layer the desk uses for clients, then
// comes back to the page with ?test=sent|failed so the row can say so.

export async function sendTestEmail(): Promise<void> {
  const user = await requireAdmin();
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());

  const result = await sendEmail({
    to: user.email,
    subject: "JetNine desk · test email",
    text: [
      `${user.firstName ?? "Hi"},`,
      "",
      `This is a test from Settings › Connections, sent ${when} Los Angeles time.`,
      "If you are reading it, email from the desk is working.",
    ].join("\n"),
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#0F1115;line-height:1.55;max-width:560px;margin:0 auto;padding:24px;">
        <p style="margin:0 0 16px;font-size:15px;">${user.firstName ? escape(user.firstName) : "Hi"},</p>
        <p style="margin:0 0 16px;font-size:15px;">This is a test from Settings › Connections, sent ${escape(when)} Los Angeles time.</p>
        <p style="margin:0;font-size:15px;">If you are reading it, email from the desk is working.</p>
      </div>`.trim(),
  });

  redirect(`/admin/settings/connections?test=${result.ok ? `sent&provider=${result.provider}` : "failed"}`);
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
