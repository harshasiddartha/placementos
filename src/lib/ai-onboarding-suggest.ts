import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";

const SYSTEM = `You are helping admins define onboarding survey questions for a coding interview prep app.
Return ONLY a JSON array (no markdown, no commentary). Each element must be an object with:
- key: unique snake_case string
- stepIndex: non-negative integer (group questions on the same step)
- orderInStep: non-negative integer (sort order within the step)
- type: one of "short_text", "radio", "textarea", "skill_sliders"
- title: string
- description: string or null
- config: object — for short_text optional fieldLabel, placeholder, minLength; for textarea placeholder, rows; for radio { options: [{ value, label, description? }] }; for skill_sliders { min, max, sliders: [{ key, title, description? }] }
- required: boolean
- active: boolean

Use sensible defaults: skill_sliders min 1, max 5.`;

export type AiProvider = "gemini" | "groq";

export async function suggestOnboardingQuestionsJson(input: {
  provider: AiProvider;
  model: string;
  userInstruction: string;
  existingJsonSummary: string;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const user = [
    input.existingJsonSummary.trim()
      ? `Current questions (summary or JSON):\n${input.existingJsonSummary.slice(0, 12000)}`
      : "No existing questions provided.",
    "",
    "Instruction:",
    input.userInstruction.trim(),
  ].join("\n");

  try {
    if (input.provider === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        return {
          ok: false,
          error: "Set GEMINI_API_KEY or GOOGLE_API_KEY for Gemini.",
        };
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: input.model.trim() || "gemini-2.0-flash",
        contents: `${SYSTEM}\n\n${user}`,
      });
      const text = response.text?.trim();
      if (!text) {
        return { ok: false, error: "Gemini returned an empty response." };
      }
      return { ok: true, text };
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return { ok: false, error: "Set GROQ_API_KEY for Groq." };
    }
    const client = new Groq({ apiKey: groqKey });
    const completion = await client.chat.completions.create({
      model: input.model.trim() || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      max_tokens: 8192,
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return { ok: false, error: "Groq returned an empty response." };
    }
    return { ok: true, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI request failed.";
    return { ok: false, error: msg };
  }
}
