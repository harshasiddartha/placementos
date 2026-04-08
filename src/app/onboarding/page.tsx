import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DbSchemaMissingCard } from "@/components/db-schema-missing";
import { OnboardingEmptyQuestionsCard } from "@/components/onboarding/onboarding-empty-questions";
import { OnboardingSurvey } from "@/components/onboarding/onboarding-survey";
import { mergeDefaultAnswers } from "@/lib/onboarding-answers";
import { getOnboardingStateForUser } from "@/lib/onboarding-db";
import { listActiveOnboardingQuestionsSafe } from "@/lib/onboarding-questions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Onboarding · PrepMind AI",
  description:
    "SWE/SDE placement prep — tell us where you are and what you’re aiming for",
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/onboarding")}`);
  }

  const [state, catalog] = await Promise.all([
    getOnboardingStateForUser(user.id),
    listActiveOnboardingQuestionsSafe(),
  ]);

  if (!state.ok || !catalog.ok) {
    return (
      <main className="flex flex-1 flex-col items-center px-4 py-10 md:py-16">
        <DbSchemaMissingCard />
      </main>
    );
  }

  if (catalog.questions.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center px-4 py-10 md:py-16">
        <OnboardingEmptyQuestionsCard />
      </main>
    );
  }

  const initialAnswers = mergeDefaultAnswers(
    catalog.questions,
    state.answers,
    state.profileDisplayName,
  );

  return (
    <main className="flex flex-1 flex-col px-4 py-10 md:py-16">
      <OnboardingSurvey
        questions={catalog.questions}
        initialAnswers={initialAnswers}
        initialCompleted={state.completed}
      />
    </main>
  );
}
