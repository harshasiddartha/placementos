import { type NextRequest, NextResponse } from "next/server";

import {
  ADMIN_COOKIE_NAME,
  adminCookieMatchesEnv,
  getAdminTokenFromEnv,
} from "@/lib/admin-guard";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (pathname.startsWith("/admin/login")) {
      return response;
    }
    const token = getAdminTokenFromEnv();
    if (!token) {
      return new NextResponse(
        "Admin is not configured. Set ADMIN_ACCESS_TOKEN in the server environment.",
        { status: 503 },
      );
    }
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!adminCookieMatchesEnv(cookie)) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image optimization.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
