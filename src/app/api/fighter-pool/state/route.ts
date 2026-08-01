import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFighterPoolState } from "@/features/fighter-pool/fighter-pool.service";

export const dynamic = "force-dynamic";
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getFighterPoolState(session.user.id), { headers: { "Cache-Control": "no-store" } });
}
