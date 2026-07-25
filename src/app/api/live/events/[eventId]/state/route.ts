import { getLiveEventStateSignature } from "@/features/live/live-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const signature = await getLiveEventStateSignature(eventId);

  return Response.json(
    { signature },
    { headers: { "Cache-Control": "no-store" } },
  );
}
