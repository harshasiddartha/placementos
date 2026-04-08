import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Account",
};

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/account")}`);
  }

  let profile: {
    id: string;
    displayName: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null = null;
  let onboardingCompleted: boolean | null = null;
  let dbError: string | null = null;

  try {
    const [p, ob] = await Promise.all([
      prisma.profile.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          displayName: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.onboardingResponse.findUnique({
        where: { userId: user.id },
        select: { completedAt: true },
      }),
    ]);
    profile = p;
    onboardingCompleted = ob ? ob.completedAt !== null : false;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
      dbError =
        "Tables are missing. From the project root run: npx prisma migrate deploy (uses DIRECT_URL).";
    } else {
      dbError =
        e instanceof Error
          ? e.message
          : "Database error — check DATABASE_URL and run `npx prisma migrate deploy`.";
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 text-muted-foreground",
          )}
        >
          ← Home
        </Link>
      </div>
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Auth via Supabase; profile loaded with Prisma from the same Postgres database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>
          {dbError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
              {dbError}
            </p>
          ) : profile ? (
            <>
              <div>
                <p className="text-muted-foreground">Display name</p>
                <p className="font-medium">{profile.displayName ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Onboarding</p>
                <p className="font-medium">
                  {onboardingCompleted === null
                    ? "—"
                    : onboardingCompleted
                      ? "Completed"
                      : "In progress"}
                </p>
              </div>
              <div className="grid gap-1 text-xs text-muted-foreground">
                <span>User id: {profile.id}</span>
                <span>Updated: {profile.updatedAt.toLocaleString()}</span>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              No profile row yet. After migrations and a new signup, the trigger should create
              one.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
