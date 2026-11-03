import { useState, type ReactElement } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, Copy, RotateCw } from "lucide-react";
import type { AccountStatus } from "@fs-career/contracts";
import { ActionButton } from "@fs-career/ui/button";
import { FormMessage } from "@fs-career/ui/field";
import { FlightMap } from "@fs-career/ui/flight-map";
import { cn } from "@fs-career/ui/cn";
import { ease } from "@fs-career/ui/motion";
import { Panel } from "@fs-career/ui/panel";
import { formatCode, send } from "../lib/connector";

// Shown until the pilot is signed in: the app gets a code, and the pilot approves it on airspace.club.
// It sits on the route map, like the website's sign-in pages.
export function SignIn({ account }: { account: AccountStatus }): ReactElement {
  return (
    <div className="relative grid flex-1 place-items-center overflow-hidden px-6">
      <div aria-hidden className="absolute inset-0 opacity-50">
        <FlightMap className="h-full w-full text-paper" />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_50%_50%,rgba(11,13,16,0.95),rgba(11,13,16,0.6)_65%,rgba(11,13,16,0.25))]" />

      <div className="relative w-full max-w-sm">
        {/* While the app is still checking, the same card shows with a skeleton where the code goes, so it never
            jumps when the code arrives. */}
        {account.state === "error" ? (
          <Failed message={account.message} />
        ) : (
          <Code userCode={account.state === "signing-in" ? account.userCode : undefined} />
        )}
      </div>
    </div>
  );
}

// The card rises in as the screen opens.
const pop = {
  initial: { opacity: 0, y: 24, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.8, ease, delay: 0.12 },
};

function Code({ userCode }: { userCode?: string }): ReactElement {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    if (userCode === undefined) return;
    await navigator.clipboard.writeText(formatCode(userCode));
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2_000);
  }

  return (
    <motion.div {...pop}>
      <Panel className="p-7 text-center">
        <h1 className="display text-2xl">Sign In</h1>
        <p className="mt-2 text-sm text-paper/55">Confirm this code at airspace.club/device.</p>

        <div className={cn("well relative mt-6 rounded-xl px-12 py-5", userCode !== undefined && "trace")}>
          {/* Letter spacing trails the last character; the padding gives it back so the code sits dead centre. */}
          <AnimatePresence mode="wait" initial={false}>
            {userCode !== undefined ? (
              <motion.p
                key="code"
                initial={{ opacity: 0, filter: "blur(6px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.4, ease }}
                className="pl-[0.2em] font-mono text-3xl leading-9 font-medium tracking-[0.2em] select-text"
              >
                {formatCode(userCode)}
              </motion.p>
            ) : (
              // One slot per character, laid out like the code, with a wave running through them.
              <motion.span
                key="skeleton"
                exit={{ opacity: 0 }}
                className="flex h-9 items-center justify-center gap-[6px]"
              >
                {Array.from({ length: 8 }, (_, i) => (
                  <motion.span
                    key={i}
                    className={cn("h-7 w-[18px] rounded-[5px] bg-paper/10", i === 4 && "ml-[22px]")}
                    animate={{ opacity: [0.35, 1, 0.35] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.09 }}
                  />
                ))}
              </motion.span>
            )}
          </AnimatePresence>
          <button
            disabled={userCode === undefined}
            type="button"
            onClick={() => {
              void copy();
            }}
            aria-label={copied ? "Copied" : "Copy code"}
            className="absolute top-1/2 right-2.5 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-paper/55 transition-colors hover:bg-paper/10 hover:text-paper disabled:pointer-events-none disabled:opacity-0"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={copied ? "copied" : "copy"}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.15 }}
              >
                {copied ? <Check className="size-4" strokeWidth={3} /> : <Copy className="size-4" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
        <p className="sr-only" role="status">
          {userCode !== undefined ? "Waiting for approval" : "Getting a code"}
        </p>

        <ActionButton
          variant="paper"
          disabled={userCode === undefined}
          onClick={() => {
            send({ type: "open-sign-in" });
          }}
          className="mt-6 w-full"
        >
          Open Browser
          <ArrowUpRight className="size-4" />
        </ActionButton>
      </Panel>
      <p className="mt-5 text-center text-xs text-paper/45">
        New to Airspace?{" "}
        <button
          type="button"
          onClick={() => {
            send({ type: "open-website" });
          }}
          className="font-medium text-paper/80 transition-colors hover:text-paper"
        >
          Create an Account
        </button>
      </p>
    </motion.div>
  );
}

function Failed({ message }: { message: string }): ReactElement {
  return (
    <motion.div {...pop}>
      <Panel className="flex flex-col gap-5 p-7">
        <h1 className="display text-center text-2xl">Sign In Failed</h1>
        <FormMessage>{message}</FormMessage>
        <ActionButton
          variant="paper"
          onClick={() => {
            send({ type: "retry-sign-in" });
          }}
          className="w-full"
        >
          <RotateCw className="size-4" />
          Get A New Code
        </ActionButton>
      </Panel>
    </motion.div>
  );
}
