import { prisma } from "@/lib/prisma";

const LOCK_ID = "site";
const CACHE_MS = 1_000;

let cached: { active: boolean; expiresAt: number } | undefined;
let readPending: Promise<boolean> | undefined;
let activationPending: Promise<void> | undefined;

export async function isEmergencyLocked() {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.active;

  readPending ??= prisma.emergencyLock.findUnique({
    where: { id: LOCK_ID },
    select: { active: true },
  }).then((record) => record?.active ?? false).catch((error) => {
    console.error("[rfl-security] Could not read emergency lock state", error);
    return false;
  });

  const active = await readPending;
  readPending = undefined;
  cached = { active, expiresAt: Date.now() + CACHE_MS };
  return active;
}

export async function activateEmergencyLockdown(cause: string) {
  if (cached?.active) return;
  activationPending ??= prisma.emergencyLock.upsert({
    where: { id: LOCK_ID },
    create: {
      id: LOCK_ID,
      active: true,
      activatedAt: new Date(),
      activationCause: cause,
    },
    update: {
      active: true,
      activatedAt: new Date(),
      activationCause: cause,
      unlockedAt: null,
      unlockedBy: null,
    },
  }).then(() => {
    cached = { active: true, expiresAt: Number.POSITIVE_INFINITY };
    console.error(`[rfl-security] Emergency lockdown activated: ${cause}`);
  }).finally(() => {
    activationPending = undefined;
  });

  await activationPending;
}

export async function deactivateEmergencyLockdown(unlockedBy: string) {
  await prisma.emergencyLock.upsert({
    where: { id: LOCK_ID },
    create: { id: LOCK_ID, active: false, unlockedAt: new Date(), unlockedBy },
    update: { active: false, unlockedAt: new Date(), unlockedBy },
  });
  cached = { active: false, expiresAt: Date.now() + CACHE_MS };
  console.info(`[rfl-security] Emergency lockdown removed by Discord owner ${unlockedBy}`);
}

export function clearEmergencyLockdownCacheForTests() {
  cached = undefined;
  readPending = undefined;
  activationPending = undefined;
}
