"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_COOKIE_NAME,
  getAdminTokenFromEnv,
  timingSafeEqualString,
} from "@/lib/admin-guard";

export async function loginAdminAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: false; error: string } | void> {
  const expected = getAdminTokenFromEnv();
  if (!expected) {
    return { ok: false, error: "ADMIN_ACCESS_TOKEN is not set on the server." };
  }
  const submitted = String(formData.get("token") ?? "");
  if (!timingSafeEqualString(submitted, expected)) {
    return { ok: false, error: "Invalid access token." };
  }
  const jar = await cookies();
  jar.set(ADMIN_COOKIE_NAME, submitted, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect("/admin/onboarding");
}

export async function logoutAdminAction() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE_NAME);
  redirect("/admin/login");
}
