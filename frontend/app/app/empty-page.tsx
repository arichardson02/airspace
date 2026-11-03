"use client";

import type { ReactElement } from "react";
import { motion } from "framer-motion";
import { rise } from "@fs-career/ui/motion";
import { Page } from "@fs-career/ui/shell";

interface EmptyPageProps {
  title: string;
  /** What the page shows once there is data. */
  sub: string;
  /** What has to happen first. */
  next: string;
}

// A page with nothing to show yet. It says what will appear and how, never placeholder data.
export function EmptyPage({ title, sub, next }: EmptyPageProps): ReactElement {
  return (
    <Page title={title} sub={sub}>
      <motion.div
        {...rise(0.16)}
        className="mt-7 flex min-h-[260px] max-w-3xl items-center justify-center rounded-[18px] border border-dashed border-paper/15 px-6 text-center"
      >
        <div>
          <p className="display text-xl">Nothing yet</p>
          <p className="mt-2 text-[14.5px] text-muted">{next}</p>
        </div>
      </motion.div>
    </Page>
  );
}
