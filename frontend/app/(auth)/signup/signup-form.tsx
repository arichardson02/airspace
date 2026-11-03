"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type ReactElement } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { ActionButton } from "@fs-career/ui/button";
import { AuthCard } from "@/components/auth/auth-card";
import { Field, FormMessage } from "@fs-career/ui/field";
import { formText, safeRedirect } from "@/lib/forms";
import { useAuthForm } from "@/components/auth/use-auth-form";
import { authClient } from "@/lib/auth-client";

const MIN_PASSWORD_LENGTH = 8;

export function SignupForm(): ReactElement {
  const searchParams = useSearchParams();
  const redirect = safeRedirect(searchParams.get("redirect"));
  const [sentTo, setSentTo] = useState<string>();
  const { error, pending, settle, handleSubmit } = useAuthForm();

  async function send(form: FormData): Promise<void> {
    const email = formText(form, "email");

    // The verification link signs the pilot in and lands them on `redirect`.
    const { error: failure } = await authClient.signUp.email({
      name: formText(form, "name").trim(),
      email,
      password: formText(form, "password"),
      callbackURL: redirect,
    });

    if (!failure) {
      settle();
      setSentTo(email);
    } else if (failure.status === 429) settle("Too many attempts. Wait a minute and try again.");
    else if (failure.code?.startsWith("USER_ALREADY_EXISTS") === true) {
      settle("There's already an account with that email.");
    } else settle(failure.message ?? "Couldn't create your account. Try again.");
  }

  if (sentTo !== undefined && sentTo !== "") {
    return (
      <AuthCard
        title="Check Your Inbox"
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
        <div className="flex items-center gap-3 well rounded-xl px-4 py-3 text-sm text-paper/70">
          <Mail className="size-4 shrink-0" />
          It can take a minute. Check spam if it doesn&apos;t show up.
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create Your Account"
      subtitle="Free during early access."
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
      <form onSubmit={handleSubmit(send)} className="flex flex-col gap-5">
        <Field
          label="Pilot Name"
          name="name"
          autoComplete="nickname"
          required
          maxLength={40}
          placeholder="Mara Kovac"
        />
        <Field label="Email" name="email" type="email" autoComplete="email" placeholder="pilot@example.com" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        />

        {error !== undefined && <FormMessage>{error}</FormMessage>}

        <ActionButton type="submit" variant="paper" disabled={pending} className="mt-1 w-full">
          {pending ? "Creating account…" : "Get Started"}
          {!pending && <ArrowRight className="size-4" />}
        </ActionButton>
      </form>
    </AuthCard>
  );
}
