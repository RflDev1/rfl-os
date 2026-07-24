import type { Prisma } from "@/generated/prisma/client";

const FIGHTER_RANK_ASSIGNMENT_LOCK = 7_346_521;

export async function nextFighterRank(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${FIGHTER_RANK_ASSIGNMENT_LOCK})`;
  const highest = await tx.fighter.aggregate({ _max: { rank: true } });
  return (highest._max.rank ?? 0) + 1;
}
