"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  applyOnboardingJsonAction,
  deleteOnboardingQuestionAction,
  suggestOnboardingWithAiAction,
  upsertOnboardingQuestionAction,
  validateOnboardingJsonAction,
} from "@/app/admin/onboarding/actions";
import type { AdminOnboardingQuestionRow } from "@/app/admin/onboarding/page";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ONBOARDING_QUESTION_TYPES } from "@/lib/onboarding-question-schema";

function configToJson(config: Record<string, unknown>): string {
  try {
    return JSON.stringify(config, null, 2);
  } catch {
    return "{}";
  }
}

const DEFAULT_CONFIG = `{
  "placeholder": ""
}`;

export function AdminOnboardingClient({
  initialQuestions,
}: {
  initialQuestions: AdminOnboardingQuestionRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialQuestions);
  const [pending, startTransition] = useTransition();

  const [key, setKey] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [orderInStep, setOrderInStep] = useState(0);
  const [type, setType] = useState<string>("short_text");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [configJson, setConfigJson] = useState(DEFAULT_CONFIG);
  const [required, setRequired] = useState(true);
  const [active, setActive] = useState(true);

  const [aiProvider, setAiProvider] = useState<"gemini" | "groq">("gemini");
  const [aiModel, setAiModel] = useState("gemini-2.0-flash");
  const [aiInstruction, setAiInstruction] = useState(
    "Suggest a concise onboarding flow for SWE interview prep: profile name, track choice, goals textarea, and skill sliders for DSA, system design, and communication.",
  );
  const [aiOutput, setAiOutput] = useState("");

  const [banner, setBanner] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  useEffect(() => {
    setRows(initialQuestions);
  }, [initialQuestions]);

  const existingSummary = useMemo(
    () => JSON.stringify(rows, null, 2),
    [rows],
  );

  const clearForm = useCallback(() => {
    setKey("");
    setStepIndex(0);
    setOrderInStep(0);
    setType("short_text");
    setTitle("");
    setDescription("");
    setConfigJson(DEFAULT_CONFIG);
    setRequired(true);
    setActive(true);
  }, []);

  const loadRow = useCallback((r: AdminOnboardingQuestionRow) => {
    setKey(r.key);
    setStepIndex(r.stepIndex);
    setOrderInStep(r.orderInStep);
    setType(r.type);
    setTitle(r.title);
    setDescription(r.description ?? "");
    setConfigJson(configToJson(r.config));
    setRequired(r.required);
    setActive(r.active);
  }, []);

  const showBanner = useCallback((kind: "ok" | "err", text: string) => {
    setBanner({ kind, text });
    window.setTimeout(() => setBanner(null), 8000);
  }, []);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const onSave = () => {
    startTransition(async () => {
      const r = await upsertOnboardingQuestionAction({
        key,
        stepIndex: Number(stepIndex),
        orderInStep: Number(orderInStep),
        type,
        title,
        description,
        configJson,
        required,
        active,
      });
      if (r.ok) {
        showBanner("ok", "Saved.");
        clearForm();
        refresh();
      } else {
        showBanner("err", r.error);
      }
    });
  };

  const onDelete = (k: string) => {
    if (!window.confirm(`Delete question "${k}"?`)) return;
    startTransition(async () => {
      const r = await deleteOnboardingQuestionAction(k);
      if (r.ok) {
        showBanner("ok", "Deleted.");
        if (key === k) clearForm();
        refresh();
      } else {
        showBanner("err", r.error);
      }
    });
  };

  const onSuggest = () => {
    startTransition(async () => {
      const r = await suggestOnboardingWithAiAction({
        provider: aiProvider,
        model: aiModel,
        instruction: aiInstruction,
        existingSummary,
      });
      if (r.ok) {
        setAiOutput(r.text);
        showBanner("ok", "AI draft ready — review JSON below.");
      } else {
        showBanner("err", r.error);
      }
    });
  };

  const onValidateAi = () => {
    startTransition(async () => {
      const r = await validateOnboardingJsonAction(aiOutput);
      if (r.ok) {
        showBanner("ok", `Valid: ${r.count} question(s).`);
      } else {
        showBanner("err", r.error);
      }
    });
  };

  const onApplyAi = () => {
    if (
      !window.confirm(
        "Apply this JSON to the database? Existing rows with the same keys will be updated.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const r = await applyOnboardingJsonAction(aiOutput);
      if (r.ok) {
        showBanner("ok", `Applied ${r.applied} question(s).`);
        refresh();
      } else {
        showBanner("err", r.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-8">
      {banner ? (
        <p
          className={
            banner.kind === "ok"
              ? "text-sm text-emerald-600 dark:text-emerald-400"
              : "text-sm text-destructive"
          }
        >
          {banner.text}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>All questions</CardTitle>
          <CardDescription>
            Load a row into the editor, or add a new <code className="text-xs">key</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-h-56 overflow-auto rounded-md border border-border/60 text-sm">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr className="border-b border-border/60">
                  <th className="p-2 font-medium">Key</th>
                  <th className="p-2 font-medium">Step</th>
                  <th className="p-2 font-medium">Type</th>
                  <th className="p-2 font-medium">Title</th>
                  <th className="p-2 font-medium">Active</th>
                  <th className="p-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-border/40">
                    <td className="p-2 font-mono text-xs">{r.key}</td>
                    <td className="p-2 tabular-nums">{r.stepIndex}</td>
                    <td className="p-2">{r.type}</td>
                    <td className="max-w-[200px] truncate p-2">{r.title}</td>
                    <td className="p-2">{r.active ? "yes" : "no"}</td>
                    <td className="flex flex-wrap gap-1 p-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => loadRow(r)}
                      >
                        Load
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDelete(r.key)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manual editor</CardTitle>
          <CardDescription>
            Types: <code className="text-xs">short_text</code>,{" "}
            <code className="text-xs">radio</code>,{" "}
            <code className="text-xs">textarea</code>,{" "}
            <code className="text-xs">skill_sliders</code>. Match{" "}
            <code className="text-xs">config</code> to the survey component expectations.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="q-key">key (unique)</Label>
            <Input
              id="q-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g. display_name"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="q-step">stepIndex</Label>
            <Input
              id="q-step"
              type="number"
              min={0}
              value={stepIndex}
              onChange={(e) => setStepIndex(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="q-order">orderInStep</Label>
            <Input
              id="q-order"
              type="number"
              min={0}
              value={orderInStep}
              onChange={(e) => setOrderInStep(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="q-type">type</Label>
            <select
              id="q-type"
              className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {ONBOARDING_QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="q-title">title</Label>
            <Input
              id="q-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="q-desc">description</Label>
            <Textarea
              id="q-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="q-config">config (JSON)</Label>
            <Textarea
              id="q-config"
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              rows={8}
              className="font-mono text-xs"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
            />
            required
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            active
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="button" onClick={onSave} disabled={pending}>
              Save question
            </Button>
            <Button type="button" variant="outline" onClick={clearForm}>
              Clear form
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI assistant</CardTitle>
          <CardDescription>
            Uses{" "}
            <code className="text-xs">@google/genai</code> (Gemini Developer API) or{" "}
            <code className="text-xs">groq-sdk</code>. Set{" "}
            <code className="text-xs">GEMINI_API_KEY</code> /{" "}
            <code className="text-xs">GOOGLE_API_KEY</code> or{" "}
            <code className="text-xs">GROQ_API_KEY</code> in{" "}
            <code className="text-xs">.env</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-provider">Provider</Label>
              <select
                id="ai-provider"
                className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
                value={aiProvider}
                onChange={(e) => {
                  const p = e.target.value as "gemini" | "groq";
                  setAiProvider(p);
                  setAiModel(
                    p === "gemini" ? "gemini-2.0-flash" : "llama-3.3-70b-versatile",
                  );
                }}
              >
                <option value="gemini">Gemini</option>
                <option value="groq">Groq</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-model">Model id</Label>
              <Input
                id="ai-model"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-instruction">Instruction</Label>
            <Textarea
              id="ai-instruction"
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              rows={4}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onSuggest} disabled={pending}>
              Generate JSON
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onValidateAi}
              disabled={pending || !aiOutput.trim()}
            >
              Validate JSON
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onApplyAi}
              disabled={pending || !aiOutput.trim()}
            >
              Apply to database
            </Button>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="ai-out">Model output (edit before apply)</Label>
            <Textarea
              id="ai-out"
              value={aiOutput}
              onChange={(e) => setAiOutput(e.target.value)}
              rows={14}
              className="font-mono text-xs"
              placeholder='[ { "key": "...", "type": "short_text", ... } ]'
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
