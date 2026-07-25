"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type TimelineItem = { id: string; kind: "ANNOUNCEMENT" | "FIGHT" | "RESULT"; message: string; createdAt: string };

export function LiveTimeline({ eventId, initialItems }: { eventId: string; initialItems: TimelineItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const polling = useRef<number | null>(null);
  const latest = useRef(initialItems.at(-1)?.createdAt ?? new Date(0).toISOString());
  const stateSignature = useRef<string | null>(null);

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
    async function pollState() {
      const response = await fetch(`/api/live/events/${eventId}/state`, { cache: "no-store" });
      if (!response.ok) return;
      const incoming = await response.json() as { signature: string };
      if (stateSignature.current !== null && incoming.signature !== stateSignature.current) router.refresh();
      stateSignature.current = incoming.signature;
    }
    const source = new EventSource(`/api/live/events/${eventId}/stream?after=${encodeURIComponent(latest.current)}`);
    source.onmessage = (event) => {
      add([JSON.parse(event.data) as TimelineItem]);
      router.refresh();
    };
    source.addEventListener("state-ready", (event) => {
      stateSignature.current = (JSON.parse(event.data) as { signature: string }).signature;
    });
    source.addEventListener("state", (event) => {
      stateSignature.current = (JSON.parse(event.data) as { signature: string }).signature;
      router.refresh();
    });
    source.onopen = () => {
      if (polling.current) window.clearInterval(polling.current);
      polling.current = null;
    };
    source.onerror = () => {
      if (!polling.current) {
        void Promise.all([poll(), pollState()]);
        polling.current = window.setInterval(() => void Promise.all([poll(), pollState()]), 10_000);
      }
    };
    return () => {
      source.close();
      if (polling.current) window.clearInterval(polling.current);
    };
  }, [eventId, router]);

  return <section className="live-timeline" aria-labelledby="timeline-title"><div className="timeline-heading"><span className="live-pulse" /><h2 id="timeline-title">Live updates</h2><small>{items.length ? "Connected" : "Waiting for the first update"}</small></div><div className="timeline-list" aria-live="polite">{items.length === 0 && <p className="timeline-empty">Updates from the RFL team will appear here during the event.</p>}{[...items].reverse().map((item) => <article key={item.id}><time>{new Date(item.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time><span className={`timeline-dot kind-${item.kind.toLowerCase()}`} /><div><small>{item.kind === "ANNOUNCEMENT" ? "League update" : item.kind === "RESULT" ? "Official result" : "Fight update"}</small><p>{item.message}</p></div></article>)}</div></section>;
}
