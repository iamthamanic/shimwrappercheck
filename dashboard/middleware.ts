/**
 * next-intl middleware: locale detection and routing.
 * Location: middleware.ts
 */
import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

/** Redirect /de/eng and /en/eng (invalid) to /de and /en so typos don't 404. */
function redirectEngTypo(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  const trimmed = pathname.replace(/\/$/, "");
  if (trimmed === "/de/eng" || trimmed.startsWith("/de/eng/")) {
    const rest = trimmed.slice("/de/eng".length) || "";
    return NextResponse.redirect(new URL(`/de${rest}`, request.url), 302);
  }
  if (trimmed === "/en/eng" || trimmed.startsWith("/en/eng/")) {
    const rest = trimmed.slice("/en/eng".length) || "";
    return NextResponse.redirect(new URL(`/en${rest}`, request.url), 302);
  }
  if (trimmed === "/eng" || trimmed.startsWith("/eng/")) {
    const rest = trimmed.slice("/eng".length) || "";
    return NextResponse.redirect(new URL(`/en${rest}`, request.url), 302);
  }
  return null;
}

export default function middleware(request: NextRequest) {
  const engRedirect = redirectEngTypo(request);
  if (engRedirect) return engRedirect;
  try {
    const result = intlMiddleware(request);
    if (result instanceof Promise) {
      return result.catch((e) => {
        console.error("middleware error:", e);
        return NextResponse.redirect(new URL(`/${routing.defaultLocale}`, request.url));
      });
    }
    return result;
  } catch (e) {
    console.error("middleware error:", e);
    return NextResponse.redirect(new URL(`/${routing.defaultLocale}`, request.url));
  }
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
