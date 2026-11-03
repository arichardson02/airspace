"use client";

import type { ReactElement, MouseEvent, ReactNode } from "react";
import { useLenis } from "lenis/react";

interface SectionLinkProps {
  id: string;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  "aria-current"?: "true";
  onClick?: () => void;
}

// A link to a section of the home page. It scrolls there without writing `#id` into the
// address bar; the href stays so the link still works with no script.
export function SectionLink({ id, children, onClick, ...props }: SectionLinkProps): ReactElement {
  const lenis = useLenis();

  function go(event: MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    if (lenis) lenis.scrollTo(target);
    else target.scrollIntoView({ behavior: "smooth" });
    onClick?.();
  }

  return (
    <a href={`#${id}`} onClick={go} {...props}>
      {children}
    </a>
  );
}
