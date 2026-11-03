import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign In · Airspace" };

export default function LoginPage(): ReactElement {
  // The form reads ?redirect=, which is only known at request time.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
