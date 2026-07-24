"use client";

import { useEffect, useRef, useState } from "react";

export type TimelineItem = { id: string; kind: "ANNOUNCEMENT" | "FIGHT" | "RESULT"; message: string; createdAt: string };

export function LiveTimeline({ eventId, initialItems }: { eventId: string; initialItems: TimelineItem[] }) {
  const [items, setItems] = useState(initialItems);
  const polling = useRef<number | null>(null);
  const latest = useRef(initialItems.at(-1)?.createdAt ?? new Date(0).toISOString());

  useEffect(() => {
    function add(incoming: TimelineItem[]) {
      if (!incoming.length) return;
      latest.current = incoming.at(-1)?.createdAt ?? latest.current;
      setItems((current) => {
        const known = new Set(current.map(({ id }) => id));
        return [...current, ...incoming.filter(({ id }) => !known.has(id))].slice(-100);
      });
    }
    async function poll() {
      const response = await fetch(`/api/live/events/${eventId}/updates?after=${encodeURIComponent(latest.current)}`);
      if (response.ok) add(await response.json() as TimelineItem[]);
    }
    const source = new EventSource(`/api/live/events/${eventId}/stream?after=${encodeURIComponent(latest.current)}`);
    source.onmessage = (event) => add([JSON.parse(event.data) as TimelineItem]);
    source.onopen = () => {
      if (polling.current) window.clearInterval(polling.current);
      polling.current = null;
    };
    source.onerror = () => {
      if (!polling.current) polling.current = window.setInterval(() => void poll(), 10_000);
    };
    return () => {
      source.close();
      if (polling.current) window.clearInterval(polling.current);
    };
  }, [eventId]);

  return <section className="live-timeline" aria-labelledby="timeline-title"><div className="timeline-heading"><span className="live-pulse" /><h2 id="timeline-title">Live updates</h2><small>{items.length ? "Connected" : "Waiting for the first update"}</small></div><div className="timeline-list" aria-live="polite">{items.length === 0 && <p className="timeline-empty">Updates from the RFL team will appear here during the event.</p>}{[...items].reverse().map((item) => <article key={item.id}><time>{new Date(item.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time><span className={`timeline-dot kind-${item.kind.toLowerCase()}`} /><div><small>{item.kind === "ANNOUNCEMENT" ? "League update" : item.kind === "RESULT" ? "Official result" : "Fight update"}</small><p>{item.message}</p></div></article>)}</div></section>;
}

