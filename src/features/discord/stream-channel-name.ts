function chicagoDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function streamChannelName(input: { now: Date; liveTitle?: string; upcoming?: { title: string; startsAt: Date } }) {
  if (input.liveTitle) return input.liveTitle.slice(0, 100);
  if (input.upcoming && chicagoDateKey(input.upcoming.startsAt) === chicagoDateKey(input.now)) {
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      minute: "2-digit",
    }).format(input.upcoming.startsAt);
    return `${input.upcoming.title} @ ${time} CT`.slice(0, 100);
  }
  return "Fight Stream";
}
