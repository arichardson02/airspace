import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** The lockup shows the wordmark too; the mark is for tight spots. */
  variant?: "lockup" | "mark";
  /** Set on ink surfaces. The SVG masters are black, so it inverts them. */
  inverted?: boolean;
  className?: string;
}

// The lockup's viewBox is 508 x 97, the mark's 114 x 100 (Branding/logo).
export function Logo({ variant = "lockup", inverted, className }: LogoProps) {
  const lockup = variant === "lockup";

  return (
    <Image
      src={lockup ? "/brand/lockup-horizontal.svg" : "/brand/mark.svg"}
      alt="airspace"
      width={lockup ? 508 : 114}
      height={lockup ? 97 : 100}
      priority
      className={cn("h-6 w-auto", inverted && "invert", className)}
    />
  );
}
