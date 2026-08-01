import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function verifyFighterPoolBridgeRequest(request: Request, rawBody: string) {
  const secret = getEnv().FIGHT_POOL_BRIDGE_SECRET;
  if (!secret) return false;
  const timestamp = request.headers.get("x-rfl-timestamp") ?? "";
  const signature = request.headers.get("x-rfl-signature") ?? "";
  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(timestamp).update(".").update(rawBody).digest("hex");
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
}
