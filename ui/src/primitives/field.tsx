import type { InputHTMLAttributes, ReactElement, ReactNode } from "react";
import { cn } from "../cn";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Sits right of the label, e.g. a "Forgot?" link. */
  aside?: ReactNode;
}

export function Field({ label, aside, className, id, name, ...input }: FieldProps): ReactElement {
  const inputId = id ?? name;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <label htmlFor={inputId} className="text-[13px] font-medium text-paper/80">
          {label}
        </label>
        {aside}
      </div>
      <input
        id={inputId}
        name={name}
        className={cn(
          // Sunk into the panel like every other place you read or type into.
          "well h-12 w-full rounded-xl px-4 text-[15px] text-paper outline outline-transparent transition-[outline-color] duration-200 placeholder:text-paper/30 focus:outline-paper/30",
          className,
        )}
        {...input}
      />
    </div>
  );
}

/** An error or notice under a form. Monotone like the rest of the brand: errors get weight, not red. */
export function FormMessage({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "info";
}): ReactElement {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl px-4 py-3 text-sm leading-relaxed",
        tone === "error" ? "bg-paper/10 font-medium text-paper ring-1 ring-paper/25 ring-inset" : "well text-paper/75",
      )}
    >
      {children}
    </p>
  );
}
