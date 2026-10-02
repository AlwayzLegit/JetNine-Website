import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { deskRole } from "@/lib/desk-status";

export const dynamic = "force-dynamic";

export default async function SettingsIndex() {
  const user = await requireStaff();
  redirect(deskRole(user.role) === "owner" ? "/admin/settings/reports" : "/admin/settings/notifications");
}
