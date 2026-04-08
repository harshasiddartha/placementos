import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";

import type { AiProvider } from "@/lib/ai-onboarding-suggest";
import {
  validateQuestionsPayload,
  type ValidatedQuestionInput,
} from "@/lib/onboarding-question-schema";

export type AgentChatMessage = { role: "user" | "assistant"; content: string };

const MARKER = "\n---AGENT_JSON---\n";

const SYSTEM_PREFIX = `You are PrepMind's **onboarding survey editor agent**. Admins talk in plain language; you maintain the questionnaire shown to new users.

## Output rules (critical)
1. Write a short, friendly **reply** to the admin (what you understood, what you changed or why you need clarification).
2. After that reply, output a **newline**, then a line containing **exactly** \`---AGENT_JSON---\`, then **another newline**, then **one** JSON object only (no markdown code fences, no text after the JSON):
{"message":"<same reply; escape internal quotes>","fullQuestions":null}
or replace null with the full array of all questions.
The delimiter line must be exactly: ${MARKER.trim()}

3. If you are **not** changing the survey (questions, steps, copy, options), set \`fullQuestions\` to \`null\`.
4. If you **are** changing the survey, \`fullQuestions\` must be the **complete** new survey: every question object the database should have after apply. Merge the admin's request with the current survey; keep existing questions they did not ask to remove.

## Question object shape (each element of fullQuestions)
- key: unique snake_case string
- stepIndex: non-negative int (wizard step)
- orderInStep: non-negative int (order within step)
- type: "short_text" | "radio" | "textarea" | "skill_sliders"
- title: string
- description: string or null
- config: object — short_text: fieldLabel?, placeholder?, minLength?; textarea: placeholder?, rows?; radio: options[{value,label,description?}]; skill_sliders: min,max, sliders[{key,title,description?}]
- required: boolean
- active: boolean

## Current survey (authoritative for this turn)
`;

export type AgentTurnResult =
  | {
      ok: true;
      assistantMessage: string;
      proposal: ValidatedQuestionInput[] | null;
      proposalValidationError: string | null;
    }
  | { ok: false; error: string };

function parseAgentResponse(raw: string): {
  assistantMessage: string;
  fullQuestionsRaw: unknown | null;
  jsonError: string | null;
} {
  const idx = raw.lastIndexOf(MARKER);
  if (idx === -1) {
    return {
      assistantMessage: raw.trim(),
      fullQuestionsRaw: null,
      jsonError: null,
    };
  }
  const visible = raw.slice(0, idx).trim();
  const jsonPart = raw.slice(idx + MARKER.length).trim();
  try {
    const cleaned = jsonPart.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const obj = JSON.parse(cleaned) as { message?: string; fullQuestions?: unknown };
    const message =
      typeof obj.message === "string" && obj.message.trim()
        ? obj.message.trim()
        : visible || "Done.";
    const fq = obj.fullQuestions;
    if (fq === undefined) {
      return {
        assistantMessage: message,
        fullQuestionsRaw: null,
        jsonError: null,
      };
    }
    if (fq === null) {
      return { assistantMessage: message, fullQuestionsRaw: null, jsonError: null };
    }
    return { assistantMessage: message, fullQuestionsRaw: fq, jsonError: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid JSON after marker.";
    return {
      assistantMessage: visible || raw.trim(),
      fullQuestionsRaw: null,
      jsonError: msg,
    };
  }
}

export async function runAdminOnboardingAgentTurn(input: {
  provider: AiProvider;
  model: string;
  messages: AgentChatMessage[];
  currentQuestionsJson: string;
}): Promise<AgentTurnResult> {
  const system = `${SYSTEM_PREFIX}\n${input.currentQuestionsJson}\n`;

  const lastUser = [...input.messages].reverse().find((m) => m.role === "user");
  if (!lastUser?.content?.trim()) {
    return { ok: false, error: "Missing user message." };
  }

  try {
    let rawText = "";

    if (input.provider === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        return {
          ok: false,
          error: "Set GEMINI_API_KEY or GOOGLE_API_KEY for Gemini.",
        };
      }
      const transcript = input.messages
        .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
        .join("\n\n");
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: input.model.trim() || "gemini-2.0-flash",
        contents: `${system}\n\nConversation:\n${transcript}`,
      });
      rawText = response.text?.trim() ?? "";
    } else {
      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) {
        return { ok: false, error: "Set GROQ_API_KEY for Groq." };
      }
      const client = new Groq({ apiKey: groqKey });
      const completion = await client.chat.completions.create({
        model: input.model.trim() || "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: system },
          ...input.messages.map((m) => ({
            role: m.role === "user" ? ("user" as const) : ("assistant" as const),
            content: m.content,
          })),
        ],
        temperature: 0.25,
        max_tokens: 16384,
      });
      rawText = completion.choices[0]?.message?.content?.trim() ?? "";
    }

    if (!rawText) {
      return { ok: false, error: "Model returned an empty response." };
    }

    const parsed = parseAgentResponse(rawText);
    let proposal: ValidatedQuestionInput[] | null = null;
    let proposalValidationError: string | null = parsed.jsonError;

    if (parsed.fullQuestionsRaw !== null && parsed.fullQuestionsRaw !== undefined) {
      const v = validateQuestionsPayload(parsed.fullQuestionsRaw);
      if (v.ok) {
        proposal = v.questions;
        proposalValidationError = null;
      } else {
        proposal = null;
        proposalValidationError = parsed.jsonError ?? v.error;
      }
    }

    return {
      ok: true,
      assistantMessage: parsed.assistantMessage,
      proposal,
      proposalValidationError,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Agent request failed.";
    return { ok: false, error: msg };
  }
}
