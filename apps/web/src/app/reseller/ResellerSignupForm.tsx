"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function ResellerSignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/reseller/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setError(body.error || "Unable to submit application.");
        return;
      }
      router.refresh();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <label
          htmlFor="reseller-organization-name"
          className="mb-2 block text-sm font-medium text-text-secondary"
        >
          Business or organization name
        </label>
        <input
          id="reseller-organization-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={2}
          maxLength={100}
          required
          placeholder="Example Store"
          className="h-11 w-full rounded-xl border border-border bg-bg-primary px-3 text-sm text-text-primary outline-none transition focus:border-accent"
        />
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="h-11 w-full rounded-xl bg-accent px-4 text-sm font-semibold text-bg-primary transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Apply for reseller access"}
      </button>
    </form>
  );
}
