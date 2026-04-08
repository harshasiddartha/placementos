"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.refresh();
        router.push("/");
      }}
    >
      Sign out
    </Button>
  );
}
