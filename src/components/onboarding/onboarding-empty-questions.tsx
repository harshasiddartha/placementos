import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function OnboardingEmptyQuestionsCard() {
  return (
    <Card className="mx-auto w-full max-w-lg border-border/80">
      <CardHeader>
        <CardTitle>No onboarding questions</CardTitle>
        <CardDescription>
          The <code className="text-xs">onboarding_questions</code> table has no active rows.
          Add or activate questions in the Supabase Table Editor, or re-run migrations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Back home
        </Link>
      </CardContent>
    </Card>
  );
}
