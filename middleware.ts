import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { APP_ROLE } from "./lib/config";

export function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith("/expert") &&
    APP_ROLE !== "expert"
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/expert", "/expert/:path*"],
};
