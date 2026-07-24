"use client";

import { useEffect, useState } from "react";

export function Countdown({ startsAt }: { startsAt: string }) {
  const target = new Date(startsAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = Math.max(0, target - now);
  if (remaining === 0) return <span className="countdown-live">Starting now</span>;
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor(remaining / 3_600_000) % 24;
  const minutes = Math.floor(remaining / 60_000) % 60;
  const seconds = Math.floor(remaining / 1_000) % 60;
  return <span className="countdown" aria-label={`${days} days, ${hours} hours, ${minutes} minutes`}><b>{days}<small>Days</small></b><i>:</i><b>{String(hours).padStart(2,"0")}<small>Hours</small></b><i>:</i><b>{String(minutes).padStart(2,"0")}<small>Min</small></b><i>:</i><b>{String(seconds).padStart(2,"0")}<small>Sec</small></b></span>;
}

