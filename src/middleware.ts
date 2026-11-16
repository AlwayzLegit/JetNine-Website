import { gateRequest } from "@/lib/session/middleware";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  return gateRequest(request);
}

export const config = {
  matcher: [
    // Run on every request except static assets and image opt routes.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
