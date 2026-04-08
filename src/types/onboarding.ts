/** Client-safe question shape (passed from Server Component → survey). */
export type OnboardingQuestionClient = {
  key: string;
  stepIndex: number;
  orderInStep: number;
  type: string;
  title: string;
  description: string | null;
  config: Record<string, unknown>;
  required: boolean;
};

/** Stored in DB under `onboarding_responses.answers` — keys match `onboarding_questions.key`. */
export type OnboardingAnswers = Record<string, unknown>;

export const DEFAULT_TRACK = "swe_sde";
