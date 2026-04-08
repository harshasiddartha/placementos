"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import {
  getDisplayNameFromAnswers,
  sanitizeAnswersForPersist,
  validateAnswersForComplete,
  validateAnswersForDraft,
} from "@/lib/onboarding-answers";
import { ensureProfile } from "@/lib/onboarding-db";
import { listActiveOnboardingQuestions } from "@/lib/onboarding-questions";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user.id;
}

export async function saveOnboardingAnswersAction(
  answers: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const userId = await requireUserId();
    const questions = await listActiveOnboardingQuestions();
    const err = validateAnswersForDraft(answers, questions);
    if (err) return { ok: false, error: err };

    const name = getDisplayNameFromAnswers(answers);
    await ensureProfile(userId, name);

    const payload = sanitizeAnswersForPersist(answers) as Prisma.InputJsonValue;

    await prisma.onboardingResponse.upsert({
      where: { userId },
      create: {
        userId,
        answers: payload,
        completedAt: null,
      },
      update: {
        answers: payload,
      },
    });

    revalidatePath("/onboarding");
    revalidatePath("/account");
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Save failed.";
    return { ok: false, error: message };
  }
}

export async function completeOnboardingAnswersAction(
  answers: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const userId = await requireUserId();
    const questions = await listActiveOnboardingQuestions();
    const err = validateAnswersForComplete(answers, questions);
    if (err) return { ok: false, error: err };

    const name = getDisplayNameFromAnswers(answers);
    if (name.trim().length < 2) {
      return { ok: false, error: "Name is required." };
    }

    await ensureProfile(userId, name);

    const now = new Date();
    const payload = sanitizeAnswersForPersist(answers) as Prisma.InputJsonValue;

    await prisma.onboardingResponse.upsert({
      where: { userId },
      create: {
        userId,
        answers: payload,
        completedAt: now,
      },
      update: {
        answers: payload,
        completedAt: now,
      },
    });

    await prisma.profile.update({
      where: { id: userId },
      data: { displayName: name.trim() },
    });

    revalidatePath("/onboarding");
    revalidatePath("/account");
    return { ok: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not complete onboarding.";
    return { ok: false, error: message };
  }
}

export async function reopenOnboardingAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const userId = await requireUserId();
    await prisma.onboardingResponse.updateMany({
      where: { userId },
      data: { completedAt: null },
    });
    revalidatePath("/onboarding");
    return { ok: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not reopen onboarding.";
    return { ok: false, error: message };
  }
}
