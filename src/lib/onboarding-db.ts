import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

function parseAnswersJson(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

export type OnboardingStateResult =
  | {
      ok: true;
      answers: Record<string, unknown>;
      completed: boolean;
      profileDisplayName: string | null;
    }
  | { ok: false; reason: "schema_missing" };

export async function getOnboardingStateForUser(
  userId: string,
): Promise<OnboardingStateResult> {
  try {
    const [profile, row] = await Promise.all([
      prisma.profile.findUnique({ where: { id: userId } }),
      prisma.onboardingResponse.findUnique({ where: { userId } }),
    ]);

    const answers = row ? parseAnswersJson(row.answers) : {};

    return {
      ok: true,
      answers,
      completed: row ? row.completedAt !== null : false,
      profileDisplayName: profile?.displayName ?? null,
    };
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

export async function ensureProfile(userId: string, displayName: string) {
  const name = displayName.trim() || null;
  const existing = await prisma.profile.findUnique({ where: { id: userId } });
  if (!existing) {
    await prisma.profile.create({
      data: { id: userId, displayName: name },
    });
    return;
  }
  if (name) {
    await prisma.profile.update({
      where: { id: userId },
      data: { displayName: name },
    });
  }
}
