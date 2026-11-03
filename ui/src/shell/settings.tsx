"use client";

import type { ReactElement, ReactNode } from "react";
import { motion } from "framer-motion";
import { rise } from "../motion/motion";
import { Avatar } from "./sidebar";

/** The pilot at the top of settings: who's signed in, with the action that changes it. */
export function AccountHeader({
  name,
  email,
  action,
}: {
  name: string;
  email: string;
  action: ReactNode;
}): ReactElement {
  return (
    <motion.div {...rise(0.16)} className="surface mt-7 flex items-center gap-4 rounded-[18px] px-6 py-5">
      <Avatar name={name} className="size-12 text-base" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-semibold">{name}</p>
        <p className="mt-0.5 truncate text-sm text-muted select-text">{email}</p>
      </div>
      {action}
    </motion.div>
  );
}

/** A titled group of settings rows on one surface. */
export function SettingsGroup({
  title,
  index = 0,
  children,
}: {
  title: string;
  index?: number;
  children: ReactNode;
}): ReactElement {
  return (
    <motion.section {...rise(0.24 + index * 0.06)} className="mt-8">
      <h2 className="px-1 pb-3 text-xs font-medium text-paper/40">{title}</h2>
      <div className="surface divide-y divide-paper/8 rounded-[18px]">{children}</div>
    </motion.section>
  );
}

/** One row: what it is on the left, its value or control on the right. */
export function SettingsRow({
  label,
  detail,
  children,
}: {
  label: string;
  detail?: string;
  children?: ReactNode;
}): ReactElement {
  return (
    <div className="flex min-h-14 items-center gap-4 px-6 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px]">{label}</p>
        {detail !== undefined && <p className="mt-0.5 text-[13px] text-muted">{detail}</p>}
      </div>
      {children !== undefined && <div className="shrink-0 text-sm text-paper/70">{children}</div>}
    </div>
  );
}
