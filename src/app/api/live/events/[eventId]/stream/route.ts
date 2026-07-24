import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const cursorValue = request.nextUrl.searchParams.get("after");
  let cursor = cursorValue ? new Date(cursorValue) : new Date();
  if (Number.isNaN(cursor.getTime())) cursor = new Date();
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));
      timer = setInterval(async () => {
        if (closed) return;
        try {
          const updates = await prisma.fightUpdate.findMany({ where: { eventId, createdAt: { gt: cursor } }, orderBy: { createdAt: "asc" }, take: 50 });
          for (const update of updates) {
            cursor = update.createdAt;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ...update, createdAt: update.createdAt.toISOString() })}\n\n`));
          }
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          closed = true;
          if (timer) clearInterval(timer);
          controller.close();
        }
      }, 2_000);
      request.signal.addEventListener("abort", () => {
        closed = true;
        if (timer) clearInterval(timer);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      closed = true;
      if (timer) clearInterval(timer);
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}

