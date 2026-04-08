import Link from "next/link";

import { logoutAdminAction } from "@/app/admin/login/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

import { AdminOnboardingClient } from "./admin-onboarding-client";

export type AdminOnboardingQuestionRow = {
  key: string;
  stepIndex: number;
  orderInStep: number;
  type: string;
  title: string;
  description: string | null;
  config: Record<string, unknown>;
  required: boolean;
  active: boolean;
};

export default async function AdminOnboardingPage() {
  let questions: AdminOnboardingQuestionRow[] = [];
  let loadError: string | null = null;

  try {
    const rows = await prisma.onboardingQuestion.findMany({
      orderBy: [{ stepIndex: "asc" }, { orderInStep: "asc" }, { key: "asc" }],
    });
    questions = rows.map((r) => ({
      key: r.key,
      stepIndex: r.stepIndex,
      orderInStep: r.orderInStep,
      type: r.type,
      title: r.title,
      description: r.description,
      config:
        typeof r.config === "object" && r.config !== null && !Array.isArray(r.config)
          ? (r.config as Record<string, unknown>)
          : {},
      required: r.required,
      active: r.active,
    }));
  } catch {
    loadError =
      "Could not load questions. If the database schema is missing, run `npx prisma migrate deploy`.";
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Onboarding questions
          </h1>
          <p className="text-sm text-muted-foreground">
            Edit the survey shown at{" "}
            <Link href="/onboarding" className="underline underline-offset-4">
              /onboarding
            </Link>
            . Changes apply on the next page load.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Home
          </Link>
          <form action={logoutAdminAction}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>

      {loadError ? (
        <Card>
          <CardHeader>
            <CardTitle>Database</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <AdminOnboardingClient initialQuestions={questions} />
      )}
    </main>
  );
}
