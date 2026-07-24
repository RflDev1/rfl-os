"use client";

import { useEffect, useRef, useState } from "react";
import { Crown } from "./crown";

export function CrownGainBurst({ balance, initialBalance, amount, eventKey }: { balance?: number; initialBalance?: number; amount?: number; eventKey?: string | boolean }) {
  const previous = useRef(initialBalance ?? balance);
  const [gain, setGain] = useState(0);
  const [animation, setAnimation] = useState(0);

  useEffect(() => {
    const nextGain = amount ?? (balance !== undefined && previous.current !== undefined ? balance - previous.current : 0);
    if (balance !== undefined) previous.current = balance;
    if (nextGain > 0 && eventKey) {
      setGain(nextGain);
      setAnimation((value) => value + 1);
    }
  }, [amount, balance, eventKey]);

  if (!gain || !animation) return null;
  return <div className="crown-gain-burst" key={animation} role="status"><strong>+{gain.toLocaleString()} Crowns</strong><div aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <span key={index} style={{ "--coin": index } as React.CSSProperties}><Crown /></span>)}</div></div>;
}
