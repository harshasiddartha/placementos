import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { OnboardingQuestionClient } from "@/types/onboarding";

export function serializeOnboardingQuestions(
  rows: {
    key: string;
    stepIndex: number;
    orderInStep: number;
    type: string;
    title: string;
    description: string | null;
    config: unknown;
    required: boolean;
  }[],
): OnboardingQuestionClient[] {
  return rows.map((q) => ({
    key: q.key,
    stepIndex: q.stepIndex,
    orderInStep: q.orderInStep,
    type: q.type,
    title: q.title,
    description: q.description,
    config:
      typeof q.config === "object" && q.config !== null
        ? (q.config as Record<string, unknown>)
        : {},
    required: q.required,
  }));
}

export async function listActiveOnboardingQuestions(): Promise<
  OnboardingQuestionClient[]
> {
  const rows = await prisma.onboardingQuestion.findMany({
    where: { active: true },
    orderBy: [{ stepIndex: "asc" }, { orderInStep: "asc" }],
    select: {
      key: true,
      stepIndex: true,
      orderInStep: true,
      type: true,
      title: true,
      description: true,
      config: true,
      required: true,
    },
  });
  return serializeOnboardingQuestions(rows);
}

export async function listActiveOnboardingQuestionsSafe(): Promise<
  | { ok: true; questions: OnboardingQuestionClient[] }
  | { ok: false; reason: "schema_missing" }
> {
  try {
    const questions = await listActiveOnboardingQuestions();
    return { ok: true, questions };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2021"
    ) {
      return { ok: false, reason: "schema_missing" };
    }
    throw e;
  }
}
