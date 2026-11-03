"use client";

import Link from "next/link";
import { useState, type ReactElement } from "react";
import { ArrowRight } from "lucide-react";
import { ActionButton } from "@fs-career/ui/button";
import { AuthCard } from "@/components/auth/auth-card";
import { Field, FormMessage } from "@fs-career/ui/field";
import { formText } from "@/lib/forms";
import { useAuthForm } from "@/components/auth/use-auth-form";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage(): ReactElement {
  const [sent, setSent] = useState(false);
  const { error, pending, settle, handleSubmit } = useAuthForm();

  async function send(form: FormData): Promise<void> {
    // The emailed link lands on /reset-password?token=…
    const { error: failure } = await authClient.requestPasswordReset({
      email: formText(form, "email"),
      redirectTo: "/reset-password",
    });

    if (!failure) {
      settle();
      setSent(true);
    } else if (failure.status === 429) settle("Too many attempts. Wait a minute and try again.");
    else settle(failure.message ?? "Couldn't send the email. Try again.");
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
        title="Check Your Inbox"
        subtitle="If that email has an Airspace account, a link to choose a new password is on its way."
        footer={footer}
      >
        <FormMessage tone="info">The link works for one hour.</FormMessage>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset Your Password" subtitle="Enter your email and we'll send you a link." footer={footer}>
      <form onSubmit={handleSubmit(send)} className="flex flex-col gap-5">
        <Field label="Email" name="email" type="email" autoComplete="email" placeholder="pilot@example.com" required />
        {error !== undefined && <FormMessage>{error}</FormMessage>}
        <ActionButton type="submit" variant="paper" disabled={pending} className="mt-1 w-full">
          {pending ? "Sending…" : "Send Link"}
          {!pending && <ArrowRight className="size-4" />}
        </ActionButton>
      </form>
    </AuthCard>
  );
}
