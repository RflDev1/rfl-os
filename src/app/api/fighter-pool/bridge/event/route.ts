import { NextResponse } from "next/server";
import { verifyFighterPoolBridgeRequest } from "@/features/fighter-pool/bridge-auth";
import { liveEventSchema } from "@/features/fighter-pool/fighter-pool.schema";
import { FighterPoolError, recordPoolLiveEvent } from "@/features/fighter-pool/fighter-pool.service";

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyFighterPoolBridgeRequest(request, raw)) return NextResponse.json({ error: "Unauthorized bridge request." }, { status: 401 });
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 }); }
  const parsed = liveEventSchema.safeParse(value);
  if (!parsed.success) {
    console.warn("[fighter-pool] Rejected malformed live event", parsed.error.flatten());
    return NextResponse.json({ error: "Invalid or unsupported Fighter Pool event." }, { status: 400 });
  }
  try {
    const result = await recordPoolLiveEvent(parsed.data);
    return NextResponse.json({ accepted: true, eventId: parsed.data.eventId, duplicate: result.duplicate });
  } catch (error) {
    const expected = error instanceof FighterPoolError;
    if (!expected) console.error("[fighter-pool] Live event failed", error);
    const status = expected ? (error.message.endsWith("not found.") ? 404 : 409) : 503;
    return NextResponse.json({ error: expected ? error.message : "Live event could not be recorded." }, { status });
  }
}
