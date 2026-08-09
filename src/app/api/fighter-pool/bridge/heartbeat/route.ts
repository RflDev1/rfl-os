import { NextResponse } from "next/server";
import { verifyFighterPoolBridgeRequest } from "@/features/fighter-pool/bridge-auth";
import { heartbeatSchema } from "@/features/fighter-pool/fighter-pool.schema";
import { recordPoolServerHeartbeat } from "@/features/fighter-pool/fighter-pool.service";

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyFighterPoolBridgeRequest(request, raw)) return NextResponse.json({ error: "Unauthorized bridge request." }, { status: 401 });
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 }); }
  const parsed = heartbeatSchema.safeParse(value);
  if (!parsed.success) return NextResponse.json({ error: "Invalid heartbeat.", details: parsed.error.flatten() }, { status: 400 });
  const result = await recordPoolServerHeartbeat(parsed.data);
  return NextResponse.json({ accepted: true, presenceCount: result.presenceCount, currentMatch: result.currentMatch });
}
