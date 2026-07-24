import type { DefaultSession } from "next-auth";
import type { Role, UserStatus } from "@/generated/prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      displayName: string | null;
      status: UserStatus;
      profileCompletedAt: Date | null;
      roles: Role[];
      walletBalance: number;
    } & DefaultSession["user"];
  }
}

