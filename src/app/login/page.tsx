import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const q = await searchParams;
  const initialError =
    q.error === "auth"
      ? "Email link expired or invalid. Try signing in again."
      : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="text-center">
        <Link
          href="/"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← PrepMind AI
        </Link>
      </div>
      <LoginForm initialError={initialError} redirectTo={q.next} />
    </main>
  );
}
