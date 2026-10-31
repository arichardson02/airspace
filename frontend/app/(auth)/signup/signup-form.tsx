"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { ActionButton } from "@/components/button";
import { AuthCard } from "@/components/auth/auth-card";
import { Field, FormMessage, formText, safeRedirect } from "@/components/auth/field";
import { authClient } from "@/lib/auth-client";

const MIN_PASSWORD_LENGTH = 8;

export function SignupForm() {
  const searchParams = useSearchParams();
  const redirect = safeRedirect(searchParams.get("redirect"));
  const [sentTo, setSentTo] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = formText(form, "email");
    setPending(true);
    setError(undefined);

    // The verification link signs the pilot in and lands them on `redirect`.
    const { error } = await authClient.signUp.email({
      name: formText(form, "name").trim(),
      email,
      password: formText(form, "password"),
      callbackURL: redirect,
    });

    setPending(false);
    if (!error) setSentTo(email);
    else if (error.status === 429) setError("Too many attempts. Wait a minute and try again.");
    else if (error.code?.startsWith("USER_ALREADY_EXISTS")) setError("There's already an account with that email.");
    else setError(error.message ?? "Couldn't create your account. Try again.");
  }

  if (sentTo) {
    return (
      <AuthCard
        title="Check your inbox"
        subtitle={
          <>
            We sent a link to <span className="font-medium text-paper">{sentTo}</span>. Open it to confirm your email
            and you&apos;re in.
          </>
        }
        footer={
          <Link href="/login" className="font-medium text-paper hover:underline">
            Back to sign in
          </Link>
        }
      >
        <div className="flex items-center gap-3 rounded-xl bg-paper/6 px-4 py-3 text-sm text-paper/70">
          <Mail className="size-4 shrink-0" />
          It can take a minute. Check spam if it doesn&apos;t show up.
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Free while Airspace is in early access."
      footer={
        <>
          Already flying with us?{" "}
          <Link
            href={`/login?redirect=${encodeURIComponent(redirect)}`}
            className="font-medium text-paper hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Field
          label="Pilot name"
          name="name"
          autoComplete="nickname"
          required
          maxLength={40}
          placeholder="What your crew calls you"
        />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        />

        {error && <FormMessage>{error}</FormMessage>}

        <ActionButton type="submit" variant="paper" disabled={pending} className="mt-1 w-full">
          {pending ? "Creating account…" : "Get Started"}
          {!pending && <ArrowRight className="size-4" />}
        </ActionButton>
      </form>
    </AuthCard>
  );
}
