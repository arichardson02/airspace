"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { ActionButton } from "@/components/button";
import { AuthCard } from "@/components/auth/auth-card";
import { Field, FormMessage } from "@/components/auth/field";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);

    // The emailed link lands on /reset-password?token=…
    const { error } = await authClient.requestPasswordReset({
      email: String(form.get("email")),
      redirectTo: "/reset-password",
    });

    setPending(false);
    if (!error) setSent(true);
    else if (error.status === 429) setError("Too many attempts. Wait a minute and try again.");
    else setError(error.message ?? "Couldn't send the email. Try again.");
  }

  const footer = (
    <Link href="/login" className="font-medium text-paper hover:underline">
      Back to sign in
    </Link>
  );

  if (sent) {
    // Worded the same whether or not the email has an account, so it can't be used to look one up.
    return (
      <AuthCard
        title="Check your inbox"
        subtitle="If that email has an Airspace account, a link to choose a new password is on its way."
        footer={footer}
      >
        <FormMessage tone="info">The link works for one hour.</FormMessage>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset your password" subtitle="Enter your email and we'll send you a link." footer={footer}>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        {error && <FormMessage>{error}</FormMessage>}
        <ActionButton type="submit" variant="paper" disabled={pending} className="mt-1 w-full">
          {pending ? "Sending…" : "Send Link"}
          {!pending && <ArrowRight className="size-4" />}
        </ActionButton>
      </form>
    </AuthCard>
  );
}
