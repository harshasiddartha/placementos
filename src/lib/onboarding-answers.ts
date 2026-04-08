import type { OnboardingQuestionClient } from "@/types/onboarding";
import { DEFAULT_TRACK } from "@/types/onboarding";

type RadioOption = { value: string; label: string; description?: string };
type SliderDef = { key: string; title: string; description?: string };

function defaultSkillMap(config: Record<string, unknown>): Record<string, number> {
  const sliders = (config.sliders as SliderDef[] | undefined) ?? [];
  const out: Record<string, number> = {};
  for (const s of sliders) {
    out[s.key] = 3;
  }
  return out;
}

/** Fill missing keys so the form is controlled (skills object, track, profile name). */
export function mergeDefaultAnswers(
  questions: OnboardingQuestionClient[],
  answers: Record<string, unknown>,
  profileDisplayName?: string | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...answers };
  for (const q of questions) {
    if (q.type === "skill_sliders") {
      const cur = out[q.key];
      if (cur === undefined || cur === null || typeof cur !== "object") {
        out[q.key] = defaultSkillMap(q.config);
      } else {
        const base = defaultSkillMap(q.config);
        out[q.key] = { ...base, ...(cur as Record<string, number>) };
      }
    }
  }
  if (
    (!out.display_name || String(out.display_name).trim() === "") &&
    profileDisplayName
  ) {
    out.display_name = profileDisplayName;
  }
  if (!out.track) {
    out.track = DEFAULT_TRACK;
  }
  return out;
}

export function getDisplayNameFromAnswers(
  answers: Record<string, unknown>,
): string {
  const v = answers.display_name;
  return typeof v === "string" ? v : "";
}

function validateSingleRequired(
  q: OnboardingQuestionClient,
  answers: Record<string, unknown>,
): string | null {
  const v = answers[q.key];
  if (q.type === "short_text") {
    const min = (q.config.minLength as number | undefined) ?? 1;
    const s = typeof v === "string" ? v.trim() : "";
    if (s.length < min) {
      return `${q.title}: this field is required.`;
    }
    return null;
  }
  if (q.type === "radio") {
    if (typeof v !== "string" || !v.trim()) {
      return `${q.title}: please choose an option.`;
    }
    return null;
  }
  if (q.type === "textarea") {
    if (typeof v !== "string" || !v.trim()) {
      return `${q.title}: this field is required.`;
    }
    return null;
  }
  if (q.type === "skill_sliders") {
    const min = (q.config.min as number | undefined) ?? 1;
    const max = (q.config.max as number | undefined) ?? 5;
    const sliders = (q.config.sliders as SliderDef[] | undefined) ?? [];
    const obj =
      v && typeof v === "object" ? (v as Record<string, unknown>) : {};
    for (const s of sliders) {
      const n = obj[s.key];
      if (
        typeof n !== "number" ||
        !Number.isInteger(n) ||
        n < min ||
        n > max
      ) {
        return "Please set all skill ratings (1–5).";
      }
    }
    return null;
  }
  return null;
}

/** Length / shape checks for autosave (non-blocking for optional fields). */
export function validateAnswersForDraft(
  answers: Record<string, unknown>,
  questions: OnboardingQuestionClient[],
): string | null {
  for (const q of questions) {
    const v = answers[q.key];
    if (q.type === "short_text" && typeof v === "string") {
      const max = q.config.maxLength as number | undefined;
      if (max && v.length > max) return `${q.title} is too long.`;
    }
    if (q.type === "textarea" && typeof v === "string") {
      const max = (q.config.maxLength as number | undefined) ?? 10000;
      if (v.length > max) return `${q.title} is too long.`;
    }
  }
  return null;
}

export function validateAnswersForComplete(
  answers: Record<string, unknown>,
  questions: OnboardingQuestionClient[],
): string | null {
  const draftErr = validateAnswersForDraft(answers, questions);
  if (draftErr) return draftErr;
  for (const q of questions) {
    if (!q.required) continue;
    const err = validateSingleRequired(q, answers);
    if (err) return err;
  }
  return null;
}

export function stepIsSatisfied(
  stepIndex: number,
  questions: OnboardingQuestionClient[],
  answers: Record<string, unknown>,
): boolean {
  const qs = questions.filter((q) => q.stepIndex === stepIndex);
  for (const q of qs) {
    if (!q.required) continue;
    if (validateSingleRequired(q, answers)) return false;
  }
  return true;
}

export function formatAnswerPreview(
  q: OnboardingQuestionClient,
  answers: Record<string, unknown>,
): string {
  const v = answers[q.key];
  if (q.type === "short_text" || q.type === "textarea") {
    const s = typeof v === "string" ? v.trim() : "";
    return s || "—";
  }
  if (q.type === "radio") {
    const val = typeof v === "string" ? v : "";
    const opts = (q.config.options as RadioOption[] | undefined) ?? [];
    return opts.find((o) => o.value === val)?.label ?? (val || "—");
  }
  if (q.type === "skill_sliders") {
    const sliders = (q.config.sliders as SliderDef[] | undefined) ?? [];
    const obj =
      v && typeof v === "object" ? (v as Record<string, unknown>) : {};
    return sliders
      .map((s) => {
        const n = obj[s.key];
        const num = typeof n === "number" ? n : "—";
        return `${s.title}: ${num}/5`;
      })
      .join(" · ");
  }
  return "—";
}

export function sanitizeAnswersForPersist(
  answers: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...answers };
  out.track = DEFAULT_TRACK;
  return out;
}
