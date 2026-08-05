import { NextRequest, NextResponse } from "next/server";
import { checkRequestRateLimit, type RateLimitDecision } from "@/lib/request-rate-limit";
import { activateEmergencyLockdown, isEmergencyLocked } from "@/lib/emergency-lockdown";

const ONE_MINUTE = 60_000;
const HEALTH_PATH = "/api/health/";
const DISCORD_RECOVERY_PATH = "/api/discord/interactions";
const PER_IP_EXEMPT_PATHS = [
  DISCORD_RECOVERY_PATH,
  "/api/jobs/",
];

const GLOBAL_LIMITS = {
  bridge: 600,
  auth: 300,
  api: 1_500,
  page: 3_000,
  recovery: 300,
} as const;

function clientIp(request: NextRequest) {
  return request.headers.get("do-connecting-ip")?.trim()
    || request.headers.get("cf-connecting-ip")?.trim()
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

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Keep liveness/readiness reachable so platform health probes cannot be
  // locked out by public traffic. Readiness has its own coalesced DB cache.
  if (path.startsWith(HEALTH_PATH)) return NextResponse.next();

  const recovery = path.startsWith(DISCORD_RECOVERY_PATH);
  if (!recovery && await isEmergencyLocked()) {
    return NextResponse.json(
      { error: "RFL is temporarily locked for security. Service will return after owner review." },
      { status: 503, headers: { "Cache-Control": "private, no-store", "Retry-After": "3600" } },
    );
  }

  const ip = clientIp(request);
  const bridge = path.startsWith("/api/fighter-pool/bridge/");
  const auth = path.startsWith("/api/auth/") || path === "/signin";
  const api = path.startsWith("/api/");
  const limit = bridge ? 60 : auth ? 20 : api ? 90 : 180;
  const bucket = recovery ? "recovery" : bridge ? "bridge" : auth ? "auth" : api ? "api" : "page";
  const globalDecision = checkRequestRateLimit(`global:${bucket}`, GLOBAL_LIMITS[bucket], ONE_MINUTE);

  if (!globalDecision.allowed) {
    if (!recovery) {
      await activateEmergencyLockdown(`${bucket} traffic exceeded ${globalDecision.limit} requests per minute`);
    }
    return NextResponse.json(
      { error: "The service is temporarily limiting traffic. Please try again shortly." },
      {
        status: 503,
        headers: {
          ...rateHeaders(globalDecision),
          "Retry-After": String(globalDecision.retryAfterSeconds),
          "Cache-Control": "private, no-store",
        },
      },
    );
  }

  if (PER_IP_EXEMPT_PATHS.some((prefix) => path.startsWith(prefix))) return NextResponse.next();

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
