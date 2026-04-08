"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Send, Sparkles } from "lucide-react";

import {
  adminOnboardingAgentChatAction,
  replaceOnboardingSurveyAction,
} from "@/app/admin/onboarding/actions";
import type { AdminOnboardingQuestionRow } from "@/app/admin/onboarding/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AgentChatMessage } from "@/lib/admin-onboarding-agent";
import { cn } from "@/lib/utils";

const WELCOME: AgentChatMessage = {
  role: "assistant",
  content:
    "Hi — I’m your onboarding editor. Say what you want in plain language, e.g. “On step 2, ask for college name and graduation year,” or “Add a radio for experience level.” I’ll propose an updated survey; you **Apply** when it looks right. I replace the whole questionnaire on apply, so tell me if something should stay.",
};

const STARTERS = [
  "On step 2, ask for college name and expected graduation year.",
  "Add a radio for years of experience: beginner, intermediate, advanced.",
  "Shorten all question titles and keep the same steps.",
];

function groupByStep(rows: AdminOnboardingQuestionRow[]) {
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
}

export function AgentChatClient({
  initialQuestions,
}: {
  initialQuestions: AdminOnboardingQuestionRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialQuestions);
  const [messages, setMessages] = useState<AgentChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [pendingProposalJson, setPendingProposalJson] = useState<string | null>(
    null,
  );
  const [lastWarning, setLastWarning] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<"gemini" | "groq">("gemini");
  const [aiModel, setAiModel] = useState("gemini-2.0-flash");
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRows(initialQuestions);
  }, [initialQuestions]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending) return;
      const nextMessages: AgentChatMessage[] = [
        ...messages,
        { role: "user", content: trimmed },
      ];
      setMessages(nextMessages);
      setInput("");
      setLastWarning(null);

      startTransition(async () => {
        const r = await adminOnboardingAgentChatAction({
          messages: nextMessages,
          provider: aiProvider,
          model: aiModel,
        });
        if (!r.ok) {
          setMessages((m) => [
            ...m,
            { role: "assistant", content: `Something went wrong: ${r.error}` },
          ]);
          return;
        }
        setMessages((m) => [
          ...m,
          { role: "assistant", content: r.assistantMessage },
        ]);
        if (r.validationWarning) {
          setLastWarning(r.validationWarning);
        }
        if (r.proposalJson) {
          setPendingProposalJson(r.proposalJson);
        } else {
          setPendingProposalJson(null);
        }
      });
    },
    [messages, pending, aiProvider, aiModel],
  );

  const onApply = () => {
    if (!pendingProposalJson) return;
    startTransition(async () => {
      const r = await replaceOnboardingSurveyAction(pendingProposalJson);
      if (r.ok) {
        setPendingProposalJson(null);
        setLastWarning(null);
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: `Applied ${r.count} question(s) to the database. The live survey preview will refresh.`,
          },
        ]);
        router.refresh();
      } else {
        setLastWarning(r.error);
      }
    });
  };

  const grouped = groupByStep(rows);

  return (
    <div className="flex min-h-[min(85vh,720px)] flex-col gap-4 lg:flex-row lg:gap-6">
      <aside className="border-border/80 bg-muted/15 flex max-h-52 flex-col rounded-xl border lg:max-h-none lg:w-72 lg:shrink-0">
        <div className="border-border/60 flex items-center gap-2 border-b px-3 py-2">
          <Sparkles className="text-amber-500 size-4" />
          <span className="text-sm font-medium">Live survey</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 text-sm">
          {rows.length === 0 ? (
            <p className="text-muted-foreground">No questions yet.</p>
          ) : (
            <ul className="space-y-4">
              {grouped.map(([step, list]) => (
                <li key={step}>
                  <p className="text-muted-foreground mb-1.5 text-xs font-medium uppercase tracking-wide">
                    Step {step}
                  </p>
                  <ul className="space-y-2">
                    {list.map((q) => (
                      <li
                        key={q.key}
                        className="bg-background/60 rounded-lg border border-border/50 px-2.5 py-1.5"
                      >
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="line-clamp-2 font-medium leading-snug">
                            {q.title}
                          </span>
                          <Badge variant="secondary" className="text-[0.6rem]">
                            {q.type}
                          </Badge>
                        </div>
                        {!q.active ? (
                          <span className="text-muted-foreground text-xs">
                            inactive
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <div className="border-border/80 flex min-h-[420px] min-w-0 flex-1 flex-col rounded-xl border bg-card/40">
        <div
          ref={scrollRef}
          className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
        >
          {messages.map((msg, i) => (
            <div
              key={`${i}-${msg.role}-${msg.content.slice(0, 24)}`}
              className={cn(
                "max-w-[min(100%,42rem)] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground ml-auto"
                  : "bg-muted/80 mr-auto border border-border/50",
              )}
            >
              {msg.content}
            </div>
          ))}
          {pending ? (
            <p className="text-muted-foreground text-xs">Thinking…</p>
          ) : null}
        </div>

        {pendingProposalJson ? (
          <div className="border-border/60 bg-amber-500/10 flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
            <p className="text-sm font-medium">
              Proposal ready — replaces the full survey in the database.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPendingProposalJson(null)}
                disabled={pending}
              >
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onApply}
                disabled={pending}
              >
                Apply to database
              </Button>
            </div>
          </div>
        ) : null}

        {lastWarning ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive border-t px-4 py-2 text-xs">
            {lastWarning}
          </div>
        ) : null}

        <div className="border-border/60 space-y-3 border-t p-3">
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <Button
                key={s}
                type="button"
                variant="outline"
                size="xs"
                className="text-muted-foreground h-auto max-w-full whitespace-normal py-1.5 text-left text-[0.7rem]"
                disabled={pending}
                onClick={() => send(s)}
              >
                {s}
              </Button>
            ))}
          </div>

          <details className="text-xs">
            <summary className="text-muted-foreground cursor-pointer font-medium">
              Model
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="agent-provider">Provider</Label>
                <select
                  id="agent-provider"
                  className="border-input bg-background h-8 w-full rounded-lg border px-2"
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
                <Label htmlFor="agent-model">Model id</Label>
                <input
                  id="agent-model"
                  className="border-input bg-background h-8 w-full rounded-lg border px-2 font-mono text-[0.7rem]"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                />
              </div>
            </div>
          </details>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what to add or change…"
              rows={2}
              className="min-h-[72px] flex-1 resize-none text-sm"
              disabled={pending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <Button
              type="button"
              className="shrink-0 sm:mb-0.5"
              disabled={pending || !input.trim()}
              onClick={() => send(input)}
            >
              <Send className="size-4" data-icon="inline-start" />
              Send
            </Button>
          </div>
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <MessageSquare className="size-3.5" />
            Enter to send · Shift+Enter for newline · Apply syncs the DB with the
            proposal (removes questions not in the list).
          </p>
        </div>
      </div>
    </div>
  );
}
