"use server";

import { Prisma } from "@/generated/prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileSchema, type ProfileState } from "./profile.schema";
import { parseDateOfBirth, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";

export async function completeProfile(
  _state: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  if (session.user.status !== "ACTIVE") redirect("/signin?error=AccessDenied");

  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    acceptedRules: formData.get("acceptedRules"),
    acceptedTerms: formData.get("acceptedTerms"),
    acceptedPrivacy: formData.get("acceptedPrivacy"),
    dateOfBirth: formData.get("dateOfBirth"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check your details and try again.",
      fields: {
        displayName: String(formData.get("displayName") ?? ""),
        dateOfBirth: String(formData.get("dateOfBirth") ?? ""),
      },
    };
  }

  try {
    const now = new Date();
    const dateOfBirth = parseDateOfBirth(parsed.data.dateOfBirth);
    if (!dateOfBirth) return { error: "Enter a valid birthday.", fields: parsed.data };

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          displayName: parsed.data.displayName,
          profileCompletedAt: session.user.profileCompletedAt ?? now,
          dateOfBirth,
          termsAcceptedAt: now,
          termsVersion: TERMS_VERSION,
          privacyAcceptedAt: now,
          privacyVersion: PRIVACY_VERSION,
          wallet: { upsert: { update: {}, create: {} } },
          roles: {
            connectOrCreate: {
              where: { userId_role: { userId: session.user.id, role: "PLAYER" } },
              create: { role: "PLAYER" },
            },
          },
        },
      });
      await tx.legalAcceptance.create({
        data: {
          userId: session.user.id,
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
          acceptedAt: now,
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "That player name is already taken.", fields: parsed.data };
    }
    throw error;
  }

  redirect("/play");
}
