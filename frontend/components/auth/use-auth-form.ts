"use client";

import { useState, type SubmitEvent } from "react";

interface AuthForm {
  /** What went wrong with the last attempt, shown under the form. */
  error: string | undefined;
  /** True while a request is out, so the submit button holds. */
  pending: boolean;
  /** Releases the submit button, with a message to show under the form if the attempt failed. */
  settle: (message?: string) => void;
  /** Turns a form's request into its submit handler. */
  handleSubmit: (send: (form: FormData) => Promise<void>) => (event: SubmitEvent<HTMLFormElement>) => void;
}

// The submit flow the sign-in pages share. `send` calls `settle` once its request is answered, except when it
// navigates away on success: the button stays held until the next page arrives.
export function useAuthForm(): AuthForm {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  return {
    error,
    pending,
    settle: (message) => {
      setPending(false);
      // An empty message from the server would draw an empty box, so it counts as none.
      setError(message === "" ? undefined : message);
    },
    handleSubmit: (send) => (event) => {
      event.preventDefault();
      setPending(true);
      setError(undefined);
      void send(new FormData(event.currentTarget));
    },
  };
}
