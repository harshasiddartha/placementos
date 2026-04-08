import { Prisma } from "@prisma/client";

export const ONBOARDING_QUESTION_TYPES = [
  "short_text",
  "radio",
  "textarea",
  "skill_sliders",
] as const;

export type OnboardingQuestionType = (typeof ONBOARDING_QUESTION_TYPES)[number];

export type ValidatedQuestionInput = {
  key: string;
  stepIndex: number;
  orderInStep: number;
  type: OnboardingQuestionType;
  title: string;
  description: string | null;
  config: Prisma.InputJsonValue;
  required: boolean;
  active: boolean;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseQuestionsJsonPayload(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const inner = fence ? fence[1]?.trim() ?? "" : trimmed;
  return JSON.parse(inner) as unknown;
}

export function validateQuestionRow(
  raw: unknown,
  index: number,
): { ok: true; value: ValidatedQuestionInput } | { ok: false; error: string } {
  if (!isPlainObject(raw)) {
    return { ok: false, error: `Item ${index}: expected an object.` };
  }
  const key = raw.key;
  if (typeof key !== "string" || !/^[a-z][a-z0-9_]*$/i.test(key)) {
    return {
      ok: false,
      error: `Item ${index}: "key" must be a non-empty snake_case-like string.`,
    };
  }
  const stepIndex = raw.stepIndex;
  if (typeof stepIndex !== "number" || !Number.isInteger(stepIndex) || stepIndex < 0) {
    return { ok: false, error: `Item ${index}: "stepIndex" must be a non-negative integer.` };
  }
  const orderInStep = raw.orderInStep;
  if (
    typeof orderInStep !== "number" ||
    !Number.isInteger(orderInStep) ||
    orderInStep < 0
  ) {
    return {
      ok: false,
      error: `Item ${index}: "orderInStep" must be a non-negative integer.`,
    };
  }
  const type = raw.type;
  if (typeof type !== "string" || !ONBOARDING_QUESTION_TYPES.includes(type as OnboardingQuestionType)) {
    return {
      ok: false,
      error: `Item ${index}: "type" must be one of: ${ONBOARDING_QUESTION_TYPES.join(", ")}.`,
    };
  }
  const title = raw.title;
  if (typeof title !== "string" || title.trim().length === 0) {
    return { ok: false, error: `Item ${index}: "title" is required.` };
  }
  let description: string | null = null;
  if (raw.description !== undefined && raw.description !== null) {
    if (typeof raw.description !== "string") {
      return {
        ok: false,
        error: `Item ${index}: "description" must be a string or null.`,
      };
    }
    description = raw.description;
  }
  const config = raw.config;
  const configObj = isPlainObject(config) ? config : {};
  if (config !== undefined && !isPlainObject(config)) {
    return { ok: false, error: `Item ${index}: "config" must be an object.` };
  }
  const required = raw.required;
  if (typeof required !== "boolean") {
    return { ok: false, error: `Item ${index}: "required" must be a boolean.` };
  }
  const active = raw.active;
  if (typeof active !== "boolean") {
    return { ok: false, error: `Item ${index}: "active" must be a boolean.` };
  }

  if (type === "radio") {
    const options = configObj.options;
    if (!Array.isArray(options) || options.length === 0) {
      return { ok: false, error: `Item ${index} (radio): config.options must be a non-empty array.` };
    }
    for (let j = 0; j < options.length; j++) {
      const o = options[j];
      if (!isPlainObject(o) || typeof o.value !== "string" || typeof o.label !== "string") {
        return {
          ok: false,
          error: `Item ${index} (radio): options[${j}] needs string value and label.`,
        };
      }
    }
  }
  if (type === "skill_sliders") {
    const sliders = configObj.sliders;
    if (!Array.isArray(sliders) || sliders.length === 0) {
      return {
        ok: false,
        error: `Item ${index} (skill_sliders): config.sliders must be a non-empty array.`,
      };
    }
    for (let j = 0; j < sliders.length; j++) {
      const s = sliders[j];
      if (!isPlainObject(s) || typeof s.key !== "string" || typeof s.title !== "string") {
        return {
          ok: false,
          error: `Item ${index} (skill_sliders): sliders[${j}] needs key and title strings.`,
        };
      }
    }
  }

  return {
    ok: true,
    value: {
      key,
      stepIndex,
      orderInStep,
      type: type as OnboardingQuestionType,
      title: title.trim(),
      description,
      config: configObj as Prisma.InputJsonValue,
      required,
      active,
    },
  };
}

export function validateQuestionsPayload(
  parsed: unknown,
): { ok: true; questions: ValidatedQuestionInput[] } | { ok: false; error: string } {
  if (!Array.isArray(parsed)) {
    return { ok: false, error: "JSON must be an array of question objects." };
  }
  const questions: ValidatedQuestionInput[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const row = validateQuestionRow(parsed[i], i);
    if (!row.ok) return row;
    questions.push(row.value);
  }
  return { ok: true, questions };
}
