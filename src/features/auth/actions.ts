"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";

export async function beginDiscordSignIn() {
  await signIn("discord", { redirectTo: "/welcome" });
}

export async function endSession() {
  await signOut({ redirectTo: "/" });
}

export async function openDiscordSignIn() {
  redirect("/signin");
}

