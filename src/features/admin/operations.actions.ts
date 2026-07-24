"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "./authorization";
import { prisma } from "@/lib/prisma";
import { moderateListingSchema, userRoleSchema, userStatusSchema } from "./operations.schema";

function done(path: string, message: string, error = false): never {
  revalidatePath("/admin"); revalidatePath(path);
  redirect(`${path}?${error ? "error" : "notice"}=${encodeURIComponent(message)}`);
}

export async function updateUserStatusAction(formData: FormData) {
  const session = await requireAdmin();
  const parsed = userStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) done("/admin/users", parsed.error.issues[0]?.message ?? "Check the status change.", true);
  if (parsed.data.userId === session.user.id && parsed.data.status === "SUSPENDED") done("/admin/users", "You cannot suspend your own account.", true);
  const existing = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!existing) done("/admin/users", "User not found.", true);
  await prisma.$transaction([
    prisma.user.update({ where: { id: existing.id }, data: { status: parsed.data.status } }),
    prisma.adminAuditEntry.create({ data: { actorId: session.user.id, action: "USER_STATUS_CHANGED", targetType: "User", targetId: existing.id, summary: { before: existing.status, after: parsed.data.status, reason: parsed.data.reason } } }),
  ]);
  done("/admin/users", "User status updated and audited.");
}

export async function updateUserRoleAction(formData: FormData) {
  const session = await requireAdmin();
  const parsed = userRoleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) done("/admin/users", parsed.error.issues[0]?.message ?? "Check the role change.", true);
  if (parsed.data.userId === session.user.id && parsed.data.role === "ADMIN" && parsed.data.operation === "REVOKE") done("/admin/users", "You cannot revoke your own admin role.", true);
  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) done("/admin/users", "User not found.", true);
  await prisma.$transaction(async (tx) => {
    if (parsed.data.operation === "GRANT") await tx.userRole.upsert({ where: { userId_role: { userId: user.id, role: parsed.data.role } }, create: { userId: user.id, role: parsed.data.role }, update: {} });
    else await tx.userRole.deleteMany({ where: { userId: user.id, role: parsed.data.role } });
    await tx.adminAuditEntry.create({ data: { actorId: session.user.id, action: `USER_ROLE_${parsed.data.operation}`, targetType: "User", targetId: user.id, summary: { role: parsed.data.role, reason: parsed.data.reason } } });
  });
  done("/admin/users", "User role updated and audited.");
}

export async function moderateListingAction(formData: FormData) {
  const session = await requireAdmin();
  const parsed = moderateListingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) done("/admin/marketplace", parsed.error.issues[0]?.message ?? "Check the moderation action.", true);
  const listing = await prisma.marketListing.findUnique({ where: { id: parsed.data.listingId }, include: { card: true } });
  if (!listing || listing.status !== "ACTIVE" || listing.card.ownerId !== listing.sellerId) done("/admin/marketplace", "This listing is no longer active.", true);
  await prisma.$transaction([
    prisma.marketListing.update({ where: { id: listing.id }, data: { status: "CANCELLED", closedAt: new Date() } }),
    prisma.adminAuditEntry.create({ data: { actorId: session.user.id, action: "MARKET_LISTING_MODERATED", targetType: "MarketListing", targetId: listing.id, summary: { sellerId: listing.sellerId, cardInstanceId: listing.cardInstanceId, price: listing.price, reason: parsed.data.reason } } }),
  ]);
  revalidatePath("/market");
  done("/admin/marketplace", "Listing removed and moderation reason audited.");
}
