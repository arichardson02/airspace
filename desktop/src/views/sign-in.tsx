import { useState, type ReactElement } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Check, Copy, RotateCw } from "lucide-react";
import type { AccountStatus } from "@fs-career/contracts";
import { ActionButton } from "@fs-career/ui/button";
import { FormMessage } from "@fs-career/ui/field";
import { Logo } from "@fs-career/ui/logo";
import { Panel } from "@fs-career/ui/panel";
import { Pill } from "../components/card";
import { formatCode, send } from "../lib/connector";
import { rise } from "../lib/motion";

// Shown until the pilot is signed in: the app gets a code, and the pilot approves it on airspace.club.
export function SignIn({ account }: { account: AccountStatus }): ReactElement {
  return (
    <div className="relative grid flex-1 place-items-center overflow-hidden px-6">
      {/* The website's sign-in pages sit on the route map; here a soft glow stands in for it. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(246,247,249,0.07),transparent)]" />

      <motion.div {...rise()} className="relative w-full max-w-md">
        <Logo className="mx-auto mb-8 h-6" />
        <Panel className="p-7">
          <h1 className="display text-3xl">Sign in to Airspace</h1>
          <div className="mt-7">
            {account.state === "signing-in" ? (
              <Code userCode={account.userCode} />
            ) : account.state === "error" ? (
              <Failed message={account.message} />
            ) : (
              <p className="flex items-center gap-3 text-sm text-paper/60">
                <Pill live>Checking</Pill>
                Looking for your saved sign-in…
              </p>
            )}
          </div>
        </Panel>
        <p className="mt-6 text-center text-sm text-paper/45">
          New to Airspace? You can create an account on the same page.
        </p>
      </motion.div>
    </div>
  );
}

function Code({ userCode }: { userCode: string }): ReactElement {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(formatCode(userCode));
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2_000);
  }

  return (
    <>
      <p className="text-sm leading-relaxed text-paper/60">
        Approve this code on airspace.club to connect this computer to your account.
      </p>
      <div className="mt-5 rounded-xl bg-paper/6 px-4 py-5 text-center">
        <p className="text-xs text-paper/50">Your code</p>
        <p className="mt-1.5 font-mono text-2xl font-medium tracking-[0.2em] select-text">{formatCode(userCode)}</p>
      </div>
      <div className="mt-5 flex gap-3">
        <ActionButton
          variant="ghost"
          onClick={() => {
            void copy();
          }}
          className="flex-1"
        >
          {copied ? <Check className="size-4" strokeWidth={3} /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy code"}
        </ActionButton>
        <ActionButton
          variant="paper"
          onClick={() => {
            send({ type: "open-sign-in" });
          }}
          className="flex-1"
        >
          Open browser
          <ArrowUpRight className="size-4" />
        </ActionButton>
      </div>
      <p className="mt-5 flex items-center gap-3 text-xs text-paper/50">
        <Pill live>Waiting</Pill>
        This updates as soon as you approve.
      </p>
    </>
  );
}

function Failed({ message }: { message: string }): ReactElement {
  return (
    <div className="flex flex-col gap-5">
      <FormMessage>{message}</FormMessage>
      <ActionButton
        variant="paper"
        onClick={() => {
          send({ type: "retry-sign-in" });
        }}
        className="w-full"
      >
        <RotateCw className="size-4" />
        Get a new code
      </ActionButton>
    </div>
  );
}
