"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginState = { ok: false; error: string } | null;

export function AdminLoginForm({
  action,
}: {
  action: (
    prev: unknown,
    formData: FormData,
  ) => Promise<{ ok: false; error: string } | void>;
}) {
  const [state, formAction, pending] = useActionState(action, null as LoginState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="admin-token">Access token</Label>
        <Input
          id="admin-token"
          name="token"
          type="password"
          autoComplete="off"
          required
          placeholder="Paste ADMIN_ACCESS_TOKEN"
        />
      </div>
      {state?.ok === false ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
