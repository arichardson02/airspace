export { Field, FormMessage } from "@fs-career/ui/field";

/** Keeps redirects on this site: only same-origin paths, never "//evil.com". */
export function safeRedirect(value: string | null, fallback = "/app"): string {
  return value !== null && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

/** A text field's value from submitted form data; empty when it's missing or a file. */
export function formText(form: FormData, name: string): string {
  const value = form.get(name);
  return value === null || value instanceof File ? "" : value;
}
