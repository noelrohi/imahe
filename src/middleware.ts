import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

const authRoutes = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // If not authenticated and not on auth routes, redirect to login
  if (!session && !authRoutes.includes(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If authenticated and on auth routes, redirect to dashboard
  if (session && authRoutes.includes(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  matcher: [
    "/((?!api|trpc|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
