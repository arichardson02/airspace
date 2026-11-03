import type { ReactElement } from "react";
import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import type { Pilot } from "@fs-career/contracts";
import { ActionButton } from "@fs-career/ui/button";
import { Avatar, Card } from "../components/card";
import { send } from "../lib/connector";
import { rise } from "../lib/motion";

export function Settings({ pilot, version }: { pilot: Pilot; version: string }): ReactElement {
  return (
    <div className="px-10 py-10">
      <motion.h1 {...rise(0)} className="display text-4xl">
        Settings
      </motion.h1>

      <div className="mt-10 flex max-w-xl flex-col gap-4">
        <motion.div {...rise(0.1)}>
          <Card>
            <h2 className="text-[15px] font-medium">Account</h2>
            <div className="mt-5 flex items-center gap-3">
              <Avatar name={pilot.name} />
              <div className="min-w-0">
                <p className="text-[15px] font-medium">{pilot.name}</p>
                <p className="truncate text-sm text-paper/55 select-text">{pilot.email}</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-paper/55">
              Signing out leaves any co-op group and forgets this computer. You'll get a new code to sign in again.
            </p>
            <ActionButton
              variant="ghost"
              size="sm"
              onClick={() => {
                send({ type: "sign-out" });
              }}
              className="mt-5"
            >
              <LogOut className="size-4" />
              Sign out
            </ActionButton>
          </Card>
        </motion.div>

        <motion.div {...rise(0.18)}>
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-medium">About</h2>
              <span className="text-xs text-paper/50 tabular-nums">Version {version}</span>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-paper/55">
              Airspace for Microsoft Flight Simulator 2020, on Windows 10 and 11.
            </p>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
