"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { ActionButton, Button } from "@/components/button";
import { AuthCard } from "@/components/auth/auth-card";
import { Field, FormMessage, formText } from "@/components/auth/field";
import { authClient } from "@/lib/auth-client";

const MIN_PASSWORD_LENGTH = 8;

export function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  // The backend sends INVALID_TOKEN here when the emailed link is expired or already used.
  const linkError = searchParams.get("error");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = formText(form, "password");
    if (newPassword !== form.get("confirm")) {
      setError("The passwords don't match.");
      return;
    }

    setPending(true);
    setError(undefined);
    const { error } = await authClient.resetPassword({ newPassword, token: token! });

    setPending(false);
    if (!error) setDone(true);
    else if (error.code === "INVALID_TOKEN") setError("This link has expired. Ask for a new one.");
    else setError(error.message ?? "Couldn't change your password. Try again.");
  }

  if (!token || linkError) {
    return (
      <AuthCard
        title="Link expired"
        subtitle="Password reset links work once, for one hour. Ask for a new one."
        footer={
          <Link href="/login" className="font-medium text-paper hover:underline">
            Back to sign in
          </Link>
        }
      >
        <Button href="/forgot-password" variant="paper" className="w-full">
          Send a New Link
          <ArrowRight className="size-4" />
        </Button>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Password changed" subtitle="Sign in with your new password.">
        <Button href="/login" variant="paper" className="w-full">
          Sign In
          <ArrowRight className="size-4" />
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Field
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        />
        <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" required />
        {error && <FormMessage>{error}</FormMessage>}
        <ActionButton type="submit" variant="paper" disabled={pending} className="mt-1 w-full">
          {pending ? "Saving…" : "Change Password"}
          {!pending && <ArrowRight className="size-4" />}
        </ActionButton>
      </form>
    </AuthCard>
  );
}
