import { NextRequest, NextResponse } from "next/server";
import { checkRequestRateLimit, type RateLimitDecision } from "@/lib/request-rate-limit";

const ONE_MINUTE = 60_000;
const EXEMPT_PATHS = [
  "/api/health/",
  "/api/discord/interactions",
  "/api/jobs/",
];

function clientIp(request: NextRequest) {
  return request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}

function rateHeaders(decision: RateLimitDecision) {
  return {
    "RateLimit-Limit": String(decision.limit),
    "RateLimit-Remaining": String(decision.remaining),
    "RateLimit-Reset": String(Math.ceil(decision.resetAt / 1000)),
  };
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (EXEMPT_PATHS.some((prefix) => path.startsWith(prefix))) return NextResponse.next();

  const ip = clientIp(request);
  const bridge = path.startsWith("/api/fighter-pool/bridge/");
  const auth = path.startsWith("/api/auth/") || path === "/signin";
  const api = path.startsWith("/api/");
  const limit = bridge ? 60 : auth ? 20 : api ? 90 : 180;
  const bucket = bridge ? "bridge" : auth ? "auth" : api ? "api" : "page";
  const decision = checkRequestRateLimit(`${bucket}:${ip}`, limit, ONE_MINUTE);

  if (!decision.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          ...rateHeaders(decision),
          "Retry-After": String(decision.retryAfterSeconds),
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  const response = NextResponse.next();
  for (const [name, value] of Object.entries(rateHeaders(decision))) response.headers.set(name, value);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2)$).*)"],
};
