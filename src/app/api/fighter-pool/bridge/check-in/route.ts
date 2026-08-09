import { NextResponse } from "next/server";
import { verifyFighterPoolBridgeRequest } from "@/features/fighter-pool/bridge-auth";
import { checkInSchema } from "@/features/fighter-pool/fighter-pool.schema";
import { checkInToPoolMatch, FighterPoolError } from "@/features/fighter-pool/fighter-pool.service";

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyFighterPoolBridgeRequest(request, raw)) return NextResponse.json({ error: "Unauthorized bridge request." }, { status: 401 });
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 }); }
  const parsed = checkInSchema.safeParse(value);
  if (!parsed.success) return NextResponse.json({ error: "Invalid check-in." }, { status: 400 });
  try { return NextResponse.json({ accepted: true, match: await checkInToPoolMatch(parsed.data) }); }
  catch (error) { return NextResponse.json({ error: error instanceof FighterPoolError ? error.message : "Check-in failed." }, { status: 409 }); }
}
