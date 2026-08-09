import { NextResponse } from "next/server";
import { verifyFighterPoolBridgeRequest } from "@/features/fighter-pool/bridge-auth";
import { matchStartedSchema } from "@/features/fighter-pool/fighter-pool.schema";
import { FighterPoolError, startPoolMatch } from "@/features/fighter-pool/fighter-pool.service";

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyFighterPoolBridgeRequest(request, raw)) return NextResponse.json({ error: "Unauthorized bridge request." }, { status: 401 });
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 }); }
  const parsed = matchStartedSchema.safeParse(value);
  if (!parsed.success) return NextResponse.json({ error: "Invalid match-start report." }, { status: 400 });
  try {
    const match = await startPoolMatch(parsed.data);
    return NextResponse.json({ accepted: true, matchId: match.id, status: match.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof FighterPoolError ? error.message : "Match-start report failed." }, { status: 409 });
  }
}
