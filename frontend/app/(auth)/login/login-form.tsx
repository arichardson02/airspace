"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactElement } from "react";
import { ArrowRight } from "lucide-react";
import { ActionButton } from "@/components/button";
import { AuthCard } from "@/components/auth/auth-card";
import { Field, FormMessage, formText, safeRedirect } from "@/components/auth/field";
import { useAuthForm } from "@/components/auth/use-auth-form";
import { authClient } from "@/lib/auth-client";

export function LoginForm(): ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeRedirect(searchParams.get("redirect"));
  const [email, setEmail] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState(false);
  const { error, pending, settle, handleSubmit } = useAuthForm();

  async function send(form: FormData): Promise<void> {
    setUnverified(false);

    const { error: failure } = await authClient.signIn.email({
      email: formText(form, "email"),
      password: formText(form, "password"),
    });

    if (!failure) {
      router.replace(redirect);
      router.refresh();
      return;
    }

    if (failure.code === "EMAIL_NOT_VERIFIED") {
      settle();
      setUnverified(true);
    } else if (failure.status === 429) settle("Too many attempts. Wait a minute and try again.");
    else if (failure.code === "INVALID_EMAIL_OR_PASSWORD") settle("That email and password don't match an account.");
    else settle(failure.message ?? "Couldn't sign in. Try again.");
  }

  async function resend(): Promise<void> {
    await authClient.sendVerificationEmail({ email, callbackURL: redirect });
    setResent(true);
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to pick up where you parked."
      footer={
        <>
          New to Airspace?{" "}
          <Link
            href={`/signup?redirect=${encodeURIComponent(redirect)}`}
            className="font-medium text-paper hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(send)} className="flex flex-col gap-5">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aside={
            <Link href="/forgot-password" className="text-xs text-paper/50 transition-colors hover:text-paper">
              Forgot password?
            </Link>
          }
        />

        {error !== undefined && <FormMessage>{error}</FormMessage>}
        {unverified && (
          <FormMessage tone="info">
            {resent ? (
              "We sent a new link. Check your inbox, then sign in."
            ) : (
              <>
                Confirm your email first. We sent a link when you signed up.{" "}
                <button
                  type="button"
                  onClick={() => {
                    void resend();
                  }}
                  className="font-medium text-paper underline-offset-2 hover:underline"
                >
                  Send it again
                </button>
              </>
            )}
          </FormMessage>
        )}

        <ActionButton type="submit" variant="paper" disabled={pending} className="mt-1 w-full">
          {pending ? "Signing in…" : "Sign In"}
          {!pending && <ArrowRight className="size-4" />}
        </ActionButton>
      </form>
    </AuthCard>
  );
}
