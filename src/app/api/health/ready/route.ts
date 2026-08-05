import { prisma } from "@/lib/prisma";

type Readiness = { status: "ready" | "unavailable"; httpStatus: 200 | 503 };

const READY_CACHE_MS = 10_000;
const FAILURE_CACHE_MS = 2_000;
let cached: (Readiness & { expiresAt: number }) | undefined;
let pending: Promise<Readiness> | undefined;

async function checkDatabase(): Promise<Readiness> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ready", httpStatus: 200 };
  } catch {
    return { status: "unavailable", httpStatus: 503 };
  }
}

export async function GET() {
  const now = Date.now();
  if (!cached || cached.expiresAt <= now) {
    pending ??= checkDatabase();
    const result = await pending;
    pending = undefined;
    cached = {
      ...result,
      expiresAt: Date.now() + (result.httpStatus === 200 ? READY_CACHE_MS : FAILURE_CACHE_MS),
    };
  }

  return Response.json(
    { status: cached.status },
    { status: cached.httpStatus, headers: { "Cache-Control": "no-store" } },
  );
}
