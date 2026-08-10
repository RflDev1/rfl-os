import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { verifyFighterPoolBridgeRequest } from "@/features/fighter-pool/bridge-auth";
import { resultSchema } from "@/features/fighter-pool/fighter-pool.schema";
import { completePoolMatch, FighterPoolError } from "@/features/fighter-pool/fighter-pool.service";

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyFighterPoolBridgeRequest(request, raw)) return NextResponse.json({ error: "Unauthorized bridge request." }, { status: 401 });
  let value: Prisma.InputJsonObject;
  try { value = JSON.parse(raw) as Prisma.InputJsonObject; } catch { return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 }); }
  const parsed = resultSchema.safeParse(value);
  if (!parsed.success) return NextResponse.json({ error: "Invalid official match result.", details: parsed.error.flatten() }, { status: 400 });
  try { const match = await completePoolMatch({ ...parsed.data, payload: value }); return NextResponse.json({ accepted: true, matchId: match.id }); }
  catch (error) {
    const expected = error instanceof FighterPoolError;
    if (!expected) console.error("[fighter-pool] Official result failed", error);
    const status = expected ? (error.message.endsWith("not found.") ? 404 : 409) : 503;
    return NextResponse.json({ error: expected ? error.message : "Result submission temporarily failed." }, { status });
  }
}
