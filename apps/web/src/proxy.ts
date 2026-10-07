import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

function getRequestHost(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || "";
  return host.split(",")[0].trim().split(":")[0].toLowerCase();
}

export default clerkMiddleware(async (auth, request) => {
  if (isAdminRoute(request)) {
    await auth.protect();
  }

  // Keep the public URL at reseller.eztopup.io while serving the dedicated
  // reseller route tree from the same Next.js application.
  if (getRequestHost(request) === "reseller.eztopup.io") {
    const pathname = request.nextUrl.pathname;
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/reseller";
      return NextResponse.rewrite(url);
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
