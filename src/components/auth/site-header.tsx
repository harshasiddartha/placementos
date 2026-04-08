import Link from "next/link";
import { Sparkles } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-border/60 bg-card/30">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-primary" aria-hidden />
          PrepMind AI
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/onboarding"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Onboarding
          </Link>
          {user ? (
            <>
              <Link
                href="/account"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Account
              </Link>
              <span className="hidden max-w-[140px] truncate text-xs text-muted-foreground sm:inline">
                {user.email}
              </span>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
