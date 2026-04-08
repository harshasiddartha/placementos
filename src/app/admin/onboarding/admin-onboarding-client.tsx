"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";

import {
  applyOnboardingJsonAction,
  deleteOnboardingQuestionAction,
  setQuestionActiveAction,
  suggestOnboardingWithAiAction,
  upsertOnboardingQuestionAction,
  validateOnboardingJsonAction,
} from "@/app/admin/onboarding/actions";
import type { AdminOnboardingQuestionRow } from "@/app/admin/onboarding/page";
import { Badge } from "@/components/ui/badge";
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
import {
  ONBOARDING_QUESTION_TYPES,
  parseQuestionsJsonPayload,
  validateQuestionsPayload,
} from "@/lib/onboarding-question-schema";

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

function formatOptionsPreview(r: AdminOnboardingQuestionRow): string {
  if (r.type === "radio") {
    const opts =
      (r.config.options as { label?: string; value?: string }[] | undefined) ??
      [];
    if (opts.length === 0) return "No options in config";
    return opts.map((o) => o.label ?? o.value ?? "?").join(" · ");
  }
  if (r.type === "skill_sliders") {
    const sliders =
      (r.config.sliders as { title?: string }[] | undefined) ?? [];
    if (sliders.length === 0) return "No sliders in config";
    return sliders.map((s) => s.title ?? "?").join(" · ");
  }
  if (r.type === "short_text") {
    const ph = r.config.placeholder;
    const fl = r.config.fieldLabel;
    if (typeof ph === "string" && ph) return `Placeholder: ${ph}`;
    if (typeof fl === "string" && fl) return `Label: ${fl}`;
    return "Short text";
  }
  if (r.type === "textarea") {
    const ph = r.config.placeholder;
    return typeof ph === "string" && ph ? `Placeholder: ${ph}` : "Long text";
  }
  return "—";
}

function rowToQuestionJson(r: AdminOnboardingQuestionRow): string {
  return JSON.stringify(
    {
      key: r.key,
      stepIndex: r.stepIndex,
      orderInStep: r.orderInStep,
      type: r.type,
      title: r.title,
      description: r.description,
      config: r.config,
      required: r.required,
      active: r.active,
    },
    null,
    2,
  );
}

export function AdminOnboardingClient({
  initialQuestions,
}: {
  initialQuestions: AdminOnboardingQuestionRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialQuestions);
  const [pending, startTransition] = useTransition();

  const [editingKey, setEditingKey] = useState<string | null>(null);
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
  const [enhanceNote, setEnhanceNote] = useState("");
  const [addWithAiDescription, setAddWithAiDescription] = useState("");
  const [fullSurveyNote, setFullSurveyNote] = useState(
    "Keep the same goals but tighten copy and ordering for SWE interview prep.",
  );
  const [aiPreview, setAiPreview] = useState("");

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

  const existingKeys = useMemo(() => rows.map((r) => r.key).join(", "), [rows]);

  const grouped = useMemo(() => {
    const m = new Map<number, AdminOnboardingQuestionRow[]>();
    for (const r of rows) {
      const list = m.get(r.stepIndex) ?? [];
      list.push(r);
      m.set(r.stepIndex, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.orderInStep - b.orderInStep);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [rows]);

  const clearForm = useCallback(() => {
    setEditingKey(null);
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
    setEditingKey(r.key);
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
    window.setTimeout(() => setBanner(null), 7000);
  }, []);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const loadValidatedSingleIntoForm = useCallback(
    (jsonText: string) => {
      try {
        const parsed = parseQuestionsJsonPayload(jsonText);
        const v = validateQuestionsPayload(parsed);
        if (!v.ok) {
          showBanner("err", v.error);
          return;
        }
        if (v.questions.length !== 1) {
          showBanner(
            "err",
            `Expected exactly 1 question in the JSON array; got ${v.questions.length}.`,
          );
          return;
        }
        const q = v.questions[0];
        loadRow({
          key: q.key,
          stepIndex: q.stepIndex,
          orderInStep: q.orderInStep,
          type: q.type,
          title: q.title,
          description: q.description,
          config:
            typeof q.config === "object" && q.config !== null && !Array.isArray(q.config)
              ? (q.config as Record<string, unknown>)
              : {},
          required: q.required,
          active: q.active,
        });
        showBanner("ok", "Loaded into editor — review and click Save.");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid JSON.";
        showBanner("err", msg);
      }
    },
    [loadRow, showBanner],
  );

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
    if (!window.confirm(`Delete “${k}”?`)) return;
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

  const onToggleActive = (r: AdminOnboardingQuestionRow) => {
    startTransition(async () => {
      const next = !r.active;
      const res = await setQuestionActiveAction(r.key, next);
      if (res.ok) {
        showBanner("ok", next ? "Activated." : "Deactivated.");
        refresh();
      } else {
        showBanner("err", res.error);
      }
    });
  };

  const runEnhanceAi = (r: AdminOnboardingQuestionRow) => {
    if (!enhanceNote.trim()) {
      showBanner("err", "Describe what to improve.");
      return;
    }
    startTransition(async () => {
      const res = await suggestOnboardingWithAiAction({
        provider: aiProvider,
        model: aiModel,
        instruction: enhanceNote.trim(),
        existingSummary,
        mode: "enhance_one",
        questionJsonForEnhance: rowToQuestionJson(r),
      });
      if (res.ok) {
        setAiPreview(res.text);
        showBanner("ok", "Review the preview, then load into editor or edit JSON.");
      } else {
        showBanner("err", res.error);
      }
    });
  };

  const runAddWithAi = () => {
    if (!addWithAiDescription.trim()) {
      showBanner("err", "Describe the new question.");
      return;
    }
    startTransition(async () => {
      const res = await suggestOnboardingWithAiAction({
        provider: aiProvider,
        model: aiModel,
        instruction: `${addWithAiDescription.trim()}\n\nExisting keys (do not reuse): ${existingKeys || "(none)"}`,
        existingSummary,
        mode: "add_one",
      });
      if (res.ok) {
        setAiPreview(res.text);
        showBanner("ok", "Review the preview, then load into editor.");
      } else {
        showBanner("err", res.error);
      }
    });
  };

  const runFullSurveyAi = () => {
    if (!fullSurveyNote.trim()) {
      showBanner("err", "Add an instruction for the full survey.");
      return;
    }
    startTransition(async () => {
      const res = await suggestOnboardingWithAiAction({
        provider: aiProvider,
        model: aiModel,
        instruction: fullSurveyNote.trim(),
        existingSummary,
        mode: "full",
      });
      if (res.ok) {
        setAiPreview(res.text);
        showBanner("ok", "Full survey JSON ready — validate, then apply if you intend to replace/merge.");
      } else {
        showBanner("err", res.error);
      }
    });
  };

  const onApplyFullJson = () => {
    if (
      !window.confirm(
        "Apply this JSON? Rows with matching keys will be updated; new keys will be inserted.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const r = await applyOnboardingJsonAction(aiPreview);
      if (r.ok) {
        showBanner("ok", `Applied ${r.applied} question(s).`);
        setAiPreview("");
        refresh();
      } else {
        showBanner("err", r.error);
      }
    });
  };

  const onValidatePreview = () => {
    startTransition(async () => {
      const r = await validateOnboardingJsonAction(aiPreview);
      if (r.ok) {
        showBanner("ok", `Valid JSON: ${r.count} question(s).`);
      } else {
        showBanner("err", r.error);
      }
    });
  };

  const isNew = !editingKey || editingKey !== key;

  return (
    <div className="flex flex-col gap-10">
      {banner ? (
        <div
          role="status"
          className={
            banner.kind === "ok"
              ? "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"
              : "rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          }
        >
          {banner.text}
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Current questions
            </h2>
            <p className="text-sm text-muted-foreground">
              Grouped by step. Toggle active, edit, or remove.
            </p>
          </div>
          <Button type="button" size="sm" onClick={clearForm}>
            <Plus className="size-3.5" data-icon="inline-start" />
            New question
          </Button>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No questions yet. Add one manually or use AI below.
          </p>
        ) : (
          <div className="space-y-6">
            {grouped.map(([step, list]) => (
              <div key={step} className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Step {step}
                </p>
                <ul className="space-y-2">
                  {list.map((r) => (
                    <li
                      key={r.key}
                      className="rounded-xl border border-border/70 bg-card/40 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium leading-snug">
                              {r.title}
                            </span>
                            <Badge variant="secondary" className="text-[0.65rem]">
                              {r.type}
                            </Badge>
                            {!r.active ? (
                              <Badge variant="outline" className="text-[0.65rem]">
                                off
                              </Badge>
                            ) : null}
                          </div>
                          <p className="font-mono text-xs text-muted-foreground">
                            {r.key}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatOptionsPreview(r)}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 flex-wrap gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => onToggleActive(r)}
                            disabled={pending}
                          >
                            {r.active ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => loadRow(r)}
                          >
                            Edit
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
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <Separator />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {editingKey
              ? key === editingKey
                ? `Edit “${editingKey}”`
                : "Edit question (key changed)"
              : "New question"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isNew
              ? "Choose a unique key. Save creates the row."
              : "Save updates this question."}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="q-key">Key</Label>
            <Input
              id="q-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g. career_goal"
              className="font-mono text-sm"
              readOnly={Boolean(editingKey && key === editingKey)}
            />
            {editingKey && key === editingKey ? (
              <p className="text-xs text-muted-foreground">
                Key cannot be renamed; delete and recreate if needed.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="q-step">Step</Label>
            <Input
              id="q-step"
              type="number"
              min={0}
              value={stepIndex}
              onChange={(e) => setStepIndex(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="q-order">Order in step</Label>
            <Input
              id="q-order"
              type="number"
              min={0}
              value={orderInStep}
              onChange={(e) => setOrderInStep(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="q-type">Type</Label>
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
            <Label htmlFor="q-title">Title</Label>
            <Input
              id="q-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="q-desc">Description</Label>
            <Textarea
              id="q-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="q-config">Config (JSON)</Label>
            <Textarea
              id="q-config"
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              rows={6}
              className="font-mono text-xs"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
            />
            Required
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Active
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="button" onClick={onSave} disabled={pending}>
              Save
            </Button>
            <Button type="button" variant="outline" onClick={clearForm}>
              Cancel
            </Button>
          </div>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-amber-500" />
          <h2 className="text-lg font-semibold tracking-tight">AI</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Generate JSON, then load a single question into the editor or apply a
          full list to the database.
        </p>

        <details className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium">
            Model settings
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ai-provider">Provider</Label>
              <select
                id="ai-provider"
                className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
                value={aiProvider}
                onChange={(e) => {
                  const p = e.target.value as "gemini" | "groq";
                  setAiProvider(p);
                  setAiModel(
                    p === "gemini"
                      ? "gemini-2.0-flash"
                      : "llama-3.3-70b-versatile",
                  );
                }}
              >
                <option value="gemini">Gemini</option>
                <option value="groq">Groq</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-model">Model</Label>
              <Input
                id="ai-model"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>
        </details>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Enhance with AI</CardTitle>
              <CardDescription>
                Pick a question, say what to improve; one updated question is
                returned.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="enhance-target">Question</Label>
                <select
                  id="enhance-target"
                  className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
                  value={rows.some((x) => x.key === key) ? key : ""}
                  onChange={(e) => {
                    const k = e.target.value;
                    const row = rows.find((x) => x.key === k);
                    if (row) loadRow(row);
                  }}
                >
                  <option value="">
                    Select to load in editor…
                  </option>
                  {rows.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.title} ({r.key})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="enhance-note">What should change?</Label>
                <Textarea
                  id="enhance-note"
                  value={enhanceNote}
                  onChange={(e) => setEnhanceNote(e.target.value)}
                  rows={3}
                  placeholder="e.g. Shorter title, add a “Not sure” radio option, make sliders 1–10…"
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={
                  pending || rows.length === 0 || !enhanceNote.trim() || !key
                }
                onClick={() => {
                  const r = rows.find((x) => x.key === key);
                  if (r) runEnhanceAi(r);
                  else showBanner("err", "Select a question from the list first.");
                }}
              >
                Run enhance
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Add a question with AI</CardTitle>
              <CardDescription>
                Describe the new field; AI returns one question with a new key.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="add-ai-desc">Description</Label>
                <Textarea
                  id="add-ai-desc"
                  value={addWithAiDescription}
                  onChange={(e) => setAddWithAiDescription(e.target.value)}
                  rows={5}
                  placeholder="e.g. A radio for years of experience: 0–1, 2–4, 5+"
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={pending || !addWithAiDescription.trim()}
                onClick={runAddWithAi}
              >
                Generate question
              </Button>
            </CardContent>
          </Card>
        </div>

        <details className="group rounded-lg border border-border/60">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            Advanced — regenerate full survey JSON
          </summary>
          <div className="space-y-3 border-t border-border/60 px-4 py-3">
            <Textarea
              value={fullSurveyNote}
              onChange={(e) => setFullSurveyNote(e.target.value)}
              rows={3}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || !fullSurveyNote.trim()}
              onClick={runFullSurveyAi}
            >
              Generate full survey
            </Button>
          </div>
        </details>

        <div className="space-y-2">
          <Label htmlFor="ai-preview">AI output</Label>
          <Textarea
            id="ai-preview"
            value={aiPreview}
            onChange={(e) => setAiPreview(e.target.value)}
            rows={10}
            className="font-mono text-xs"
            placeholder="Generated JSON appears here…"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || !aiPreview.trim()}
              onClick={onValidatePreview}
            >
              Validate
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending || !aiPreview.trim()}
              onClick={() => loadValidatedSingleIntoForm(aiPreview)}
            >
              Load one question into editor
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending || !aiPreview.trim()}
              onClick={onApplyFullJson}
            >
              Apply all to database
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Use “Load one” after enhance or add-one. Use “Apply all” only for a
            full array you have validated.
          </p>
        </div>
      </section>
    </div>
  );
}
