"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";

import {
  completeOnboardingAnswersAction,
  reopenOnboardingAction,
  saveOnboardingAnswersAction,
} from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  formatAnswerPreview,
  stepIsSatisfied,
  validateAnswersForComplete,
} from "@/lib/onboarding-answers";
import type { OnboardingQuestionClient } from "@/types/onboarding";

const LEGACY_KEYS = ["prepmind-onboarding-draft", "prepmind-onboarding"] as const;

type RadioOption = { value: string; label: string; description?: string };
type SliderDef = { key: string; title: string; description?: string };

export function OnboardingSurvey({
  questions,
  initialAnswers,
  initialCompleted,
}: {
  questions: OnboardingQuestionClient[];
  initialAnswers: Record<string, unknown>;
  initialCompleted: boolean;
}) {
  const router = useRouter();
  const maxQuestionStep = useMemo(
    () => Math.max(0, ...questions.map((q) => q.stepIndex)),
    [questions],
  );
  const reviewStep = maxQuestionStep + 1;
  const totalSteps = reviewStep + 1;

  const [step, setStep] = useState(0);
  const [answers, setAnswers] =
    useState<Record<string, unknown>>(initialAnswers);
  const [done, setDone] = useState(initialCompleted);
  const [mounted, setMounted] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const skipNextSave = useRef(true);

  useEffect(() => {
    setMounted(true);
    for (const k of LEGACY_KEYS) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (!mounted || done) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    setSaveState("saving");
    const t = window.setTimeout(() => {
      void (async () => {
        const r = await saveOnboardingAnswersAction(answers);
        if (r.ok) {
          setSaveState("saved");
          setSaveMessage(null);
        } else {
          setSaveState("error");
          setSaveMessage(r.error);
        }
      })();
    }, 700);
    return () => window.clearTimeout(t);
  }, [answers, mounted, done]);

  const progressPct = Math.round(((step + 1) / totalSteps) * 100);

  const questionsThisStep = useMemo(
    () => questions.filter((q) => q.stepIndex === step).sort((a, b) => a.orderInStep - b.orderInStep),
    [questions, step],
  );

  const canContinue = useMemo(() => {
    if (step < reviewStep) {
      return stepIsSatisfied(step, questions, answers);
    }
    return validateAnswersForComplete(answers, questions) === null;
  }, [step, reviewStep, questions, answers]);

  const setAnswer = useCallback((key: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  const finish = useCallback(async () => {
    setSaveMessage(null);
    const r = await completeOnboardingAnswersAction(answers);
    if (!r.ok) {
      setSaveState("error");
      setSaveMessage(r.error);
      return;
    }
    router.refresh();
    setDone(true);
    setSaveState("saved");
  }, [answers, router]);

  const renderQuestion = useCallback(
    (q: OnboardingQuestionClient, idx: number) => {
      const showSep = idx > 0;
      if (q.type === "short_text") {
        const label =
          (q.config.fieldLabel as string | undefined) ?? "Your answer";
        const placeholder = (q.config.placeholder as string | undefined) ?? "";
        const val =
          typeof answers[q.key] === "string" ? (answers[q.key] as string) : "";
        return (
          <div key={q.key} className="space-y-4">
            {showSep ? <Separator /> : null}
            <h3 className="text-base font-semibold leading-snug">{q.title}</h3>
            {q.description ? (
              <p className="text-sm text-muted-foreground">{q.description}</p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={q.key}>{label}</Label>
              <Input
                id={q.key}
                autoComplete="name"
                placeholder={placeholder}
                value={val}
                onChange={(e) => setAnswer(q.key, e.target.value)}
              />
            </div>
          </div>
        );
      }
      if (q.type === "radio") {
        const opts = (q.config.options as RadioOption[] | undefined) ?? [];
        const val = typeof answers[q.key] === "string" ? answers[q.key] : "";
        return (
          <div key={q.key} className="space-y-4">
            {showSep ? <Separator className="my-6" /> : null}
            <div className="space-y-3">
              <h3 className="text-base font-semibold leading-snug">{q.title}</h3>
              {q.description ? (
                <p className="text-sm text-muted-foreground">{q.description}</p>
              ) : null}
              <RadioGroup
                className="gap-3"
                value={val as string}
                onValueChange={(v) => setAnswer(q.key, v)}
              >
                {opts.map((opt) => (
                  <div
                    key={opt.value}
                    className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
                  >
                    <RadioGroupItem
                      value={opt.value}
                      id={`${q.key}-${opt.value}`}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <Label
                        htmlFor={`${q.key}-${opt.value}`}
                        className="cursor-pointer font-medium leading-snug"
                      >
                        {opt.label}
                      </Label>
                      {opt.description ? (
                        <p className="text-xs text-muted-foreground">
                          {opt.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>
        );
      }
      if (q.type === "textarea") {
        const placeholder =
          (q.config.placeholder as string | undefined) ?? "";
        const rows = (q.config.rows as number | undefined) ?? 3;
        const val =
          typeof answers[q.key] === "string" ? (answers[q.key] as string) : "";
        return (
          <div key={q.key} className="space-y-4">
            {showSep ? <Separator /> : null}
            <h3 className="text-base font-semibold leading-snug">{q.title}</h3>
            {q.description ? (
              <p className="text-sm text-muted-foreground">{q.description}</p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={q.key} className="sr-only">
                {q.title}
              </Label>
              <Textarea
                id={q.key}
                placeholder={placeholder}
                rows={rows}
                value={val}
                onChange={(e) => setAnswer(q.key, e.target.value)}
                className="resize-none"
              />
            </div>
          </div>
        );
      }
      if (q.type === "skill_sliders") {
        const sliders = (q.config.sliders as SliderDef[] | undefined) ?? [];
        const min = (q.config.min as number | undefined) ?? 1;
        const max = (q.config.max as number | undefined) ?? 5;
        const raw = answers[q.key];
        const map =
          raw && typeof raw === "object"
            ? { ...(raw as Record<string, number>) }
            : {};
        const updateSkill = (sk: string, v: number | readonly number[]) => {
          const arr = Array.isArray(v) ? v : [v];
          const n = arr[0] ?? min;
          setAnswer(q.key, { ...map, [sk]: n });
        };
        return (
          <div key={q.key} className="space-y-6">
            {showSep ? <Separator className="my-6" /> : null}
            <h3 className="text-base font-semibold leading-snug">{q.title}</h3>
            {q.description ? (
              <p className="text-sm text-muted-foreground">{q.description}</p>
            ) : null}
            {sliders.map((s) => (
              <div key={s.key} className="space-y-3">
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{s.title}</span>
                    <span className="tabular-nums text-sm text-muted-foreground">
                      {(map[s.key] ?? min)} / {max}
                    </span>
                  </div>
                  {s.description ? (
                    <p className="text-xs text-muted-foreground">
                      {s.description}
                    </p>
                  ) : null}
                </div>
                <Slider
                  min={min}
                  max={max}
                  step={1}
                  value={[typeof map[s.key] === "number" ? map[s.key]! : min]}
                  onValueChange={(v) => updateSkill(s.key, v)}
                  aria-label={s.title}
                />
              </div>
            ))}
          </div>
        );
      }
      return (
        <p key={q.key} className="text-sm text-muted-foreground">
          Unsupported question type: {q.type}
        </p>
      );
    },
    [answers, setAnswer],
  );

  if (done) {
    return (
      <Card className="mx-auto w-full max-w-lg border-border/80">
        <CardHeader>
          <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Check className="size-6" aria-hidden />
          </div>
          <CardTitle>You&apos;re set</CardTitle>
          <CardDescription>
            Your onboarding is saved to your account. Add or edit questions anytime
            in Supabase (<code className="text-xs">onboarding_questions</code>).
          </CardDescription>
        </CardHeader>
        <CardFooter className="gap-2">
          <Button variant="outline" onClick={() => router.push("/")}>
            Home
          </Button>
          <Button
            onClick={() => {
              void (async () => {
                const r = await reopenOnboardingAction();
                if (!r.ok) {
                  setSaveMessage(r.error);
                  return;
                }
                setDone(false);
                setStep(reviewStep);
              })();
            }}
          >
            Edit responses
          </Button>
        </CardFooter>
        {saveMessage ? (
          <CardContent>
            <p className="text-sm text-destructive">{saveMessage}</p>
          </CardContent>
        ) : null}
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="size-4" aria-hidden />
          <span className="text-xs font-medium uppercase tracking-wider">
            PrepMind · SWE / SDE
          </span>
        </div>
        <Progress value={progressPct} className="h-1.5" />
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
          <span>
            Step {step + 1} of {totalSteps}
          </span>
          {mounted && !done ? (
            <span className="tabular-nums">
              {saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                  ? "Saved"
                  : saveState === "error"
                    ? "Save failed"
                    : null}
            </span>
          ) : null}
        </div>
        {saveMessage ? (
          <p className="text-right text-xs text-destructive">{saveMessage}</p>
        ) : null}
      </div>

      <Card className="border-border/80 shadow-sm">
        {step < reviewStep ? (
          <CardContent className="space-y-2 py-6">
            {questionsThisStep.map((q, i) => renderQuestion(q, i))}
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Review</CardTitle>
              <CardDescription>
                Confirm your answers. You can go back to edit any step.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {questions.map((q) => (
                <SummaryRow
                  key={q.key}
                  label={q.title}
                  value={formatAnswerPreview(q, answers)}
                />
              ))}
            </CardContent>
          </>
        )}

        <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/20">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="gap-1"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          {step < reviewStep ? (
            <Button
              type="button"
              size="sm"
              disabled={!canContinue}
              onClick={() =>
                setStep((s) => Math.min(reviewStep, s + 1))
              }
              className="gap-1"
            >
              Continue
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={!canContinue}
              onClick={() => void finish()}
              className="gap-1"
            >
              Complete
              <Check className="size-4" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-md text-right font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}
