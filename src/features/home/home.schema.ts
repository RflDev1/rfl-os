import { z } from "zod";

const name = z.string().trim().min(2).max(60);
const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).transform((value) => value || undefined);

export const fighterSchema = z.object({
  userId: z.string().cuid(),
  name,
  nickname: optionalText(40),
});

export const removeFighterSchema = z.object({
  fighterId: z.string().cuid(),
  confirmation: z.literal("REMOVE"),
});

export const eventSchema = z.object({
  title: z.string().trim().min(3).max(80),
  subtitle: optionalText(140),
  venue: optionalText(100),
  startsAt: z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), "Choose a valid date and time."),
  timezoneOffset: z.enum(["-04:00", "-05:00", "-06:00", "-07:00", "-08:00", "Z"]).default("Z"),
  status: z.enum(["DRAFT", "SCHEDULED", "LIVE"]),
  featured: z.enum(["on"]).optional().transform(Boolean),
}).transform(({ startsAt, timezoneOffset, ...event }) => ({
  ...event,
  startsAt: new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(startsAt) ? startsAt : `${startsAt}${timezoneOffset}`),
}));

export const fightSchema = z
  .object({
    eventId: z.string().min(1),
    redFighterId: z.string().min(1),
    blueFighterId: z.string().min(1),
    position: z.coerce.number().int().min(1).max(100),
  })
  .refine((value) => value.redFighterId !== value.blueFighterId, {
    message: "Choose two different fighters.",
  });

export const announcementSchema = z.object({
  message: z.string().trim().min(3).max(180),
  linkLabel: optionalText(30),
  linkUrl: z
    .string()
    .trim()
    .max(300)
    .refine((value) => !value || value.startsWith("/"), "Use an internal path beginning with /.")
    .transform((value) => value || undefined),
});

export const eventVisibilitySchema = z.object({
  eventId: z.string().min(1),
  status: z.enum(["DRAFT", "SCHEDULED", "LIVE", "COMPLETED", "CANCELLED"]),
  featured: z.enum(["on"]).optional().transform(Boolean),
});

export const contentIdSchema = z.object({ id: z.string().min(1) });
