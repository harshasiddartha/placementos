"use client";

import { useState } from "react";

import { AdminOnboardingClient } from "@/app/admin/onboarding/admin-onboarding-client";
import { AgentChatClient } from "@/app/admin/onboarding/agent-chat-client";
import type { AdminOnboardingQuestionRow } from "@/app/admin/onboarding/page";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AdminOnboardingShell({
  initialQuestions,
}: {
  initialQuestions: AdminOnboardingQuestionRow[];
}) {
  const [tab, setTab] = useState<"agent" | "classic">("agent");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-border/60 pb-3">
        <Button
          type="button"
          variant={tab === "agent" ? "default" : "ghost"}
          size="sm"
          className={cn(tab !== "agent" && "text-muted-foreground")}
          onClick={() => setTab("agent")}
        >
          Assistant
        </Button>
        <Button
          type="button"
          variant={tab === "classic" ? "default" : "ghost"}
          size="sm"
          className={cn(tab !== "classic" && "text-muted-foreground")}
          onClick={() => setTab("classic")}
        >
          Classic editor
        </Button>
      </div>

      {tab === "agent" ? (
        <AgentChatClient initialQuestions={initialQuestions} />
      ) : (
        <AdminOnboardingClient initialQuestions={initialQuestions} />
      )}
    </div>
  );
}
