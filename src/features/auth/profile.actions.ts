"use server";

import { Prisma } from "@/generated/prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileSchema, type ProfileState } from "./profile.schema";

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
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check your details and try again.",
      fields: { displayName: String(formData.get("displayName") ?? "") },
    };
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        displayName: parsed.data.displayName,
        profileCompletedAt: new Date(),
        wallet: { upsert: { update: {}, create: {} } },
        roles: {
          connectOrCreate: {
            where: { userId_role: { userId: session.user.id, role: "PLAYER" } },
            create: { role: "PLAYER" },
          },
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "That player name is already taken.", fields: parsed.data };
    }
    throw error;
  }

  redirect("/play");
}

