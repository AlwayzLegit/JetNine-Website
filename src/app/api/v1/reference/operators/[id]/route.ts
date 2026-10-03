import { apiHandler } from "@/app/api/v1/_lib/handler";
import { ROUTE } from "@/app/api/v1/_lib/routes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const PATCH = apiHandler(ROUTE.updateOperator);
