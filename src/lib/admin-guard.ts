import { cookies } from "next/headers";

/** HttpOnly cookie set after successful `/admin/login`. Value equals `ADMIN_ACCESS_TOKEN`. */
export const ADMIN_COOKIE_NAME = "placementos_admin";

export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

export function getAdminTokenFromEnv(): string | undefined {
  const t = process.env.ADMIN_ACCESS_TOKEN;
  return t && t.length > 0 ? t : undefined;
}

export function adminCookieMatchesEnv(cookieValue: string | undefined): boolean {
  const expected = getAdminTokenFromEnv();
  if (!expected) return false;
  if (!cookieValue) return false;
  return timingSafeEqualString(cookieValue, expected);
}

/** For server actions / route handlers. */
export async function assertAdminCookie(): Promise<void> {
  const expected = getAdminTokenFromEnv();
  if (!expected) {
    throw new Error("ADMIN_ACCESS_TOKEN is not set.");
  }
  const jar = await cookies();
  const c = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (!adminCookieMatchesEnv(c)) {
    throw new Error("Unauthorized");
  }
}
