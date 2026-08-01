import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { verifyFighterPoolBridgeRequest } from "@/features/fighter-pool/bridge-auth";
import { resultSchema } from "@/features/fighter-pool/fighter-pool.schema";
import { completePoolMatch, FighterPoolError } from "@/features/fighter-pool/fighter-pool.service";

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyFighterPoolBridgeRequest(request, raw)) return NextResponse.json({ error: "Unauthorized bridge request." }, { status: 401 });
  const value = JSON.parse(raw) as Prisma.InputJsonObject;
  const parsed = resultSchema.safeParse(value);
  if (!parsed.success) return NextResponse.json({ error: "Invalid best-of-three result.", details: parsed.error.flatten() }, { status: 400 });
  try { const match = await completePoolMatch({ ...parsed.data, payload: value }); return NextResponse.json({ accepted: true, matchId: match.id }); }
  catch (error) { return NextResponse.json({ error: error instanceof FighterPoolError ? error.message : "Result submission failed." }, { status: 409 }); }
}
