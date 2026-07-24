"use client";

import { useActionState } from "react";
import { completeProfile } from "./profile.actions";
import type { ProfileState } from "./profile.schema";

const initialState: ProfileState = {};

export function ProfileForm({ suggestedName }: { suggestedName: string }) {
  const [state, action, pending] = useActionState(completeProfile, initialState);

  return (
    <form action={action} className="profile-form">
      <label className="field-label" htmlFor="displayName">Player name</label>
      <input
        className="text-field"
        defaultValue={state.fields?.displayName ?? suggestedName}
        id="displayName"
        maxLength={24}
        name="displayName"
        autoComplete="nickname"
        aria-describedby="name-help profile-error"
        required
      />
      <p className="field-help" id="name-help">This is how other RFL players will know you.</p>

      <label className="check-row">
        <input name="acceptedRules" type="checkbox" required />
        <span>I understand Crowns are virtual rewards with no cash value.</span>
      </label>

      <p className="form-error" id="profile-error" role="alert">{state.error}</p>
      <button className="button button-primary button-wide" disabled={pending} type="submit">
        {pending ? "Preparing your corner…" : "Enter RFL"}
      </button>
    </form>
  );
}
