/** Prevent open redirects: only same-origin paths. */
export function safeNextPath(next: string | undefined, fallback = "/onboarding"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
