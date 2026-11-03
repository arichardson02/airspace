"use client";

import { useState, type ReactElement, type SubmitEvent } from "react";
import { ArrowRight, Check, ShieldAlert } from "lucide-react";
import { ActionButton } from "@fs-career/ui/button";
import { AuthCard } from "@/components/auth/auth-card";
import { Field, FormMessage } from "@fs-career/ui/field";
import { authClient } from "@/lib/auth-client";

/** Codes are shown as ABCD-EFGH but matched without punctuation, in upper case. */
const normalize = (code: string) => code.replace(/[^a-z0-9]/gi, "").toUpperCase();
const format = (code: string) => (code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code);

type Step = "enter" | "confirm" | "approved" | "denied";

export function DeviceApproval({ email, initialCode }: { email: string; initialCode: string }): ReactElement {
  const [code, setCode] = useState(normalize(initialCode));
  const [step, setStep] = useState<Step>(initialCode === "" ? "enter" : "confirm");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  function enter(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(undefined);
    setStep("confirm");
  }

  async function decide(approve: boolean): Promise<void> {
    setPending(true);
    setError(undefined);

    // Checking the code claims it for this session; only then can it be approved or denied.
    const verified = await authClient.device({ query: { user_code: code } });
    const result = verified.error
      ? verified
      : approve
        ? await authClient.device.approve({ userCode: code })
        : await authClient.device.deny({ userCode: code });

    setPending(false);
    if (!result.error) {
      setStep(approve ? "approved" : "denied");
      return;
    }
    setError(
      result.error.status === 429
        ? "Too many attempts. Wait a minute and try again."
        : "That code isn't valid or has expired. Start sign-in again from the connector.",
    );
    setStep("enter");
  }

  if (step === "approved") {
    return (
      <AuthCard title="Airspace Signed In" subtitle="You can close this tab and go back to the app.">
        <div className="flex items-center gap-3 well rounded-xl px-4 py-3 text-sm text-paper/75">
          <Check className="size-4 shrink-0" strokeWidth={3} />
          Signed in as {email}
        </div>
      </AuthCard>
    );
  }

  if (step === "denied") {
    return (
      <AuthCard title="Request Denied" subtitle="The app wasn't signed in. You can close this tab.">
        <FormMessage tone="info">If you didn&apos;t start this, nothing else is needed.</FormMessage>
      </AuthCard>
    );
  }

  if (step === "enter") {
    return (
      <AuthCard title="Sign In the App" subtitle="Enter the code the Airspace app is showing.">
        <form onSubmit={enter} className="flex flex-col gap-5">
          <Field
            label="Code"
            name="code"
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="ABCD-EFGH"
            value={format(code)}
            onChange={(event) => {
              setCode(normalize(event.target.value).slice(0, 8));
            }}
            className="text-center font-mono text-lg tracking-[0.2em] uppercase"
          />
          {error !== undefined && <FormMessage>{error}</FormMessage>}
          <ActionButton type="submit" variant="paper" disabled={code.length < 8} className="mt-1 w-full">
            Continue
            <ArrowRight className="size-4" />
          </ActionButton>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Sign In the App?"
      subtitle={
        <>
          The Airspace Connector wants to sign in as <span className="font-medium text-paper">{email}</span>. It will
          send your flights and join co-op groups as you.
        </>
      }
    >
      <div className="well rounded-xl px-4 py-5 text-center">
        <p className="text-xs text-paper/50">Check that the connector shows</p>
        <p className="mt-1.5 font-mono text-2xl font-medium tracking-[0.2em]">{format(code)}</p>
      </div>

      <p className="mt-4 flex gap-2.5 text-xs leading-relaxed text-paper/55">
        <ShieldAlert className="mt-px size-4 shrink-0" />
        Only approve a code you just started on your own computer. Never approve a code someone sent you.
      </p>

      {error !== undefined && (
        <div className="mt-4">
          <FormMessage>{error}</FormMessage>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <ActionButton
          variant="ghost"
          disabled={pending}
          onClick={() => {
            void decide(false);
          }}
          className="flex-1"
        >
          Deny
        </ActionButton>
        <ActionButton
          variant="paper"
          disabled={pending}
          onClick={() => {
            void decide(true);
          }}
          className="flex-1"
        >
          {pending ? "Approving…" : "Approve"}
        </ActionButton>
      </div>
    </AuthCard>
  );
}
