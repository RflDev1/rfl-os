"use client";

import { useFormStatus } from "react-dom";

export function RequestFightButton({ sent = false }: { sent?: boolean }) {
  const { pending } = useFormStatus();
  const disabled = sent || pending;

  return (
    <button
      className={`button ${disabled ? "request-button-disabled" : "button-primary"}`}
      disabled={disabled}
      type="submit"
    >
      {sent ? <><span className="request-check" aria-hidden="true">✓</span> Request sent</> : pending ? "Sending…" : "Request fight"}
    </button>
  );
}
