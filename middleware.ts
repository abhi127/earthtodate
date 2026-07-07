import { NextResponse, type NextRequest } from "next/server";

// Cookie-presence gate for authenticated routes. The API layer verifies the
// HMAC signature; this just keeps signed-out visitors off protected pages.
export function middleware(req: NextRequest) {
  if (!req.cookies.get("etd_session")?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/admin/:path*"],
};
