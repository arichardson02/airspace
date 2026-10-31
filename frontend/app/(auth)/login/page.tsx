import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign In · Airspace" };

export default function LoginPage() {
  // The form reads ?redirect=, which is only known at request time.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
