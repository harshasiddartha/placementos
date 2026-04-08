import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16">
      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl tracking-tight">
            Placement prep, built for SWE & SDE
          </CardTitle>
          <CardDescription className="text-base">
            {user
              ? "Continue your onboarding or pick up where you left off."
              : "Sign up to save your profile to Supabase, then complete onboarding."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link
            href="/onboarding"
            className={cn(buttonVariants({ size: "default" }), "gap-2")}
          >
            {user ? "Continue onboarding" : "Start onboarding"}
            <ArrowRight className="size-4" />
          </Link>
          {!user ? (
            <Link
              href="/signup"
              className={cn(buttonVariants({ variant: "outline", size: "default" }))}
            >
              Create account
            </Link>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
