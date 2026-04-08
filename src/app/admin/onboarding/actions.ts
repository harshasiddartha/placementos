"use server";

import { Prisma } from "@prisma/client";

import { assertAdminCookie } from "@/lib/admin-guard";
import {
  runAdminOnboardingAgentTurn,
  type AgentChatMessage,
} from "@/lib/admin-onboarding-agent";
import { suggestOnboardingQuestionsJson } from "@/lib/ai-onboarding-suggest";
import {
  parseQuestionsJsonPayload,
  validateQuestionRow,
  validateQuestionsPayload,
} from "@/lib/onboarding-question-schema";
import { prisma } from "@/lib/prisma";

function guardError(e: unknown): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : "Unauthorized";
  return { ok: false, error: msg };
}

export async function upsertOnboardingQuestionAction(input: {
  key: string;
  stepIndex: number;
  orderInStep: number;
  type: string;
  title: string;
  description: string;
  configJson: string;
  required: boolean;
  active: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdminCookie();
  } catch (e) {
    return guardError(e);
  }

  let config: unknown = {};
  try {
    config = JSON.parse(input.configJson) as unknown;
  } catch {
    return { ok: false, error: "config must be valid JSON." };
  }

  const row = {
    key: input.key.trim(),
    stepIndex: input.stepIndex,
    orderInStep: input.orderInStep,
    type: input.type,
    title: input.title,
    description: input.description.trim() === "" ? null : input.description,
    config,
    required: input.required,
    active: input.active,
  };

  const v = validateQuestionRow(row, 0);
  if (!v.ok) {
    return { ok: false, error: v.error };
  }
  const q = v.value;

  try {
    await prisma.onboardingQuestion.upsert({
      where: { key: q.key },
      create: {
        key: q.key,
        stepIndex: q.stepIndex,
        orderInStep: q.orderInStep,
        type: q.type,
        title: q.title,
        description: q.description,
        config: q.config as Prisma.InputJsonValue,
        required: q.required,
        active: q.active,
      },
      update: {
        stepIndex: q.stepIndex,
        orderInStep: q.orderInStep,
        type: q.type,
        title: q.title,
        description: q.description,
        config: q.config as Prisma.InputJsonValue,
        required: q.required,
        active: q.active,
      },
    });
    return { ok: true };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2021"
    ) {
      return {
        ok: false,
        error:
          "Database tables are missing. Run `npx prisma migrate deploy` against your database.",
      };
    }
    const msg = e instanceof Error ? e.message : "Save failed.";
    return { ok: false, error: msg };
  }
}

export async function deleteOnboardingQuestionAction(
  key: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdminCookie();
  } catch (e) {
    return guardError(e);
  }
  const k = key.trim();
  if (!k) {
    return { ok: false, error: "Missing key." };
  }
  try {
    await prisma.onboardingQuestion.delete({ where: { key: k } });
    return { ok: true };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return { ok: false, error: "Question not found." };
    }
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2021"
    ) {
      return {
        ok: false,
        error:
          "Database tables are missing. Run `npx prisma migrate deploy` against your database.",
      };
    }
    const msg = e instanceof Error ? e.message : "Delete failed.";
    return { ok: false, error: msg };
  }
}

export async function suggestOnboardingWithAiAction(input: {
  provider: "gemini" | "groq";
  model: string;
  instruction: string;
  existingSummary: string;
  mode?: "full" | "enhance_one" | "add_one";
  questionJsonForEnhance?: string;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    await assertAdminCookie();
  } catch (e) {
    return guardError(e);
  }
  return suggestOnboardingQuestionsJson({
    provider: input.provider,
    model: input.model,
    userInstruction: input.instruction,
    existingJsonSummary: input.existingSummary,
    mode: input.mode ?? "full",
    questionJsonForEnhance: input.questionJsonForEnhance,
  });
}

export async function setQuestionActiveAction(
  key: string,
  active: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdminCookie();
  } catch (e) {
    return guardError(e);
  }
  const k = key.trim();
  if (!k) {
    return { ok: false, error: "Missing key." };
  }
  try {
    await prisma.onboardingQuestion.update({
      where: { key: k },
      data: { active },
    });
    return { ok: true };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return { ok: false, error: "Question not found." };
    }
    const msg = e instanceof Error ? e.message : "Update failed.";
    return { ok: false, error: msg };
  }
}

export async function validateOnboardingJsonAction(
  jsonText: string,
): Promise<
  | { ok: true; count: number }
  | { ok: false; error: string }
> {
  try {
    await assertAdminCookie();
  } catch (e) {
    return guardError(e);
  }
  let parsed: unknown;
  try {
    parsed = parseQuestionsJsonPayload(jsonText);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid JSON.";
    return { ok: false, error: msg };
  }
  const v = validateQuestionsPayload(parsed);
  if (!v.ok) {
    return { ok: false, error: v.error };
  }
  return { ok: true, count: v.questions.length };
}

export async function applyOnboardingJsonAction(
  jsonText: string,
): Promise<{ ok: true; applied: number } | { ok: false; error: string }> {
  try {
    await assertAdminCookie();
  } catch (e) {
    return guardError(e);
  }
  let parsed: unknown;
  try {
    parsed = parseQuestionsJsonPayload(jsonText);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid JSON.";
    return { ok: false, error: msg };
  }
  const v = validateQuestionsPayload(parsed);
  if (!v.ok) {
    return { ok: false, error: v.error };
  }

  try {
    await prisma.$transaction(
      v.questions.map((q) =>
        prisma.onboardingQuestion.upsert({
          where: { key: q.key },
          create: {
            key: q.key,
            stepIndex: q.stepIndex,
            orderInStep: q.orderInStep,
            type: q.type,
            title: q.title,
            description: q.description,
            config: q.config as Prisma.InputJsonValue,
            required: q.required,
            active: q.active,
          },
          update: {
            stepIndex: q.stepIndex,
            orderInStep: q.orderInStep,
            type: q.type,
            title: q.title,
            description: q.description,
            config: q.config as Prisma.InputJsonValue,
            required: q.required,
            active: q.active,
          },
        }),
      ),
    );
    return { ok: true, applied: v.questions.length };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2021"
    ) {
      return {
        ok: false,
        error:
          "Database tables are missing. Run `npx prisma migrate deploy` against your database.",
      };
    }
    const msg = e instanceof Error ? e.message : "Apply failed.";
    return { ok: false, error: msg };
  }
}

/** Replace survey: upsert all proposed questions and delete keys not in the proposal. */
export async function replaceOnboardingSurveyAction(
  jsonText: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try {
    await assertAdminCookie();
  } catch (e) {
    return guardError(e);
  }
  let parsed: unknown;
  try {
    parsed = parseQuestionsJsonPayload(jsonText);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid JSON.";
    return { ok: false, error: msg };
  }
  const v = validateQuestionsPayload(parsed);
  if (!v.ok) {
    return { ok: false, error: v.error };
  }
  if (v.questions.length === 0) {
    return {
      ok: false,
      error: "Refusing to replace the survey with zero questions.",
    };
  }
  const keys = v.questions.map((q) => q.key);

  try {
    await prisma.$transaction(async (tx) => {
      for (const q of v.questions) {
        await tx.onboardingQuestion.upsert({
          where: { key: q.key },
          create: {
            key: q.key,
            stepIndex: q.stepIndex,
            orderInStep: q.orderInStep,
            type: q.type,
            title: q.title,
            description: q.description,
            config: q.config as Prisma.InputJsonValue,
            required: q.required,
            active: q.active,
          },
          update: {
            stepIndex: q.stepIndex,
            orderInStep: q.orderInStep,
            type: q.type,
            title: q.title,
            description: q.description,
            config: q.config as Prisma.InputJsonValue,
            required: q.required,
            active: q.active,
          },
        });
      }
      await tx.onboardingQuestion.deleteMany({
        where: { key: { notIn: keys } },
      });
    });
    return { ok: true, count: v.questions.length };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2021"
    ) {
      return {
        ok: false,
        error:
          "Database tables are missing. Run `npx prisma migrate deploy` against your database.",
      };
    }
    const msg = e instanceof Error ? e.message : "Replace failed.";
    return { ok: false, error: msg };
  }
}

export async function adminOnboardingAgentChatAction(input: {
  messages: AgentChatMessage[];
  provider: "gemini" | "groq";
  model: string;
}): Promise<
  | {
      ok: true;
      assistantMessage: string;
      proposalJson: string | null;
      validationWarning: string | null;
    }
  | { ok: false; error: string }
> {
  try {
    await assertAdminCookie();
  } catch (e) {
    return guardError(e);
  }

  let currentJson = "[]";
  try {
    const rows = await prisma.onboardingQuestion.findMany({
      orderBy: [{ stepIndex: "asc" }, { orderInStep: "asc" }, { key: "asc" }],
    });
    currentJson = JSON.stringify(
      rows.map((r) => ({
        key: r.key,
        stepIndex: r.stepIndex,
        orderInStep: r.orderInStep,
        type: r.type,
        title: r.title,
        description: r.description,
        config:
          typeof r.config === "object" && r.config !== null
            ? r.config
            : {},
        required: r.required,
        active: r.active,
      })),
      null,
      2,
    );
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2021"
    ) {
      return {
        ok: false,
        error:
          "Database tables are missing. Run `npx prisma migrate deploy` against your database.",
      };
    }
    throw e;
  }

  const turn = await runAdminOnboardingAgentTurn({
    provider: input.provider,
    model: input.model,
    messages: input.messages,
    currentQuestionsJson: currentJson,
  });

  if (!turn.ok) {
    return { ok: false, error: turn.error };
  }

  const proposalJson =
    turn.proposal && turn.proposal.length > 0
      ? JSON.stringify(turn.proposal, null, 2)
      : null;

  return {
    ok: true,
    assistantMessage: turn.assistantMessage,
    proposalJson,
    validationWarning: turn.proposalValidationError,
  };
}
