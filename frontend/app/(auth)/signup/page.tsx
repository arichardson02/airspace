import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create Account · Airspace" };

export default function SignupPage(): ReactElement {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
