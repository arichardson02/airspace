"use client";

import type { ReactElement, ReactNode } from "react";
import { ActionButton } from "@fs-career/ui/button";

// The lab's controls: a labelled row, a slider and an on/off button.
export function Knob({ label, value, children }: { label: string; value?: string; children: ReactNode }): ReactElement {
  return (
    <label className="flex items-center gap-4 text-[13px] text-paper/55">
      <span className="w-24 shrink-0">{label}</span>
      {children}
      {value !== undefined && value !== "" && <span className="w-16 shrink-0 text-right text-paper">{value}</span>}
    </label>
  );
}

interface RangeProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}

export function Range({ onChange, ...range }: RangeProps): ReactElement {
  return (
    <input
      type="range"
      {...range}
      onChange={(event) => {
        onChange(Number(event.target.value));
      }}
      className="h-1 flex-1 cursor-pointer accent-paper"
    />
  );
}

export function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }): ReactElement {
  return (
    <ActionButton size="sm" variant={on ? "paper" : "ghost"} className="self-start" onClick={onClick}>
      {label}
    </ActionButton>
  );
}
