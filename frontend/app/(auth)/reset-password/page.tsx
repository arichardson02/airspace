import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Reset Password · Airspace" };

export default function ResetPasswordPage(): ReactElement {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
