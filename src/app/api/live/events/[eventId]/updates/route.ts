import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const afterValue = request.nextUrl.searchParams.get("after");
  const after = afterValue ? new Date(afterValue) : new Date(0);
  if (Number.isNaN(after.getTime())) return Response.json({ error: "Invalid cursor." }, { status: 400 });
  const updates = await prisma.fightUpdate.findMany({ where: { eventId, createdAt: { gt: after } }, orderBy: { createdAt: "asc" }, take: 100 });
  return Response.json(updates.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })));
}

