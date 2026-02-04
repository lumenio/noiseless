import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPaths = ["/feed", "/onboarding", "/subscriptions", "/admin"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Check if path needs auth
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Check for session token (JWT strategy)
  const token =
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-authjs.session-token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
