import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DbSchemaMissingCard() {
  return (
    <Card className="mx-auto w-full max-w-lg border-border/80">
      <CardHeader>
        <CardTitle>Database not set up</CardTitle>
        <CardDescription>
          Prisma can connect, but tables like <code className="text-xs">profiles</code> are
          missing. Apply migrations against the same Supabase Postgres URL as{" "}
          <code className="text-xs">DIRECT_URL</code> in <code className="text-xs">.env</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="rounded-md bg-muted/50 p-3 font-mono text-xs">
          npx prisma migrate deploy
        </p>
        <p className="text-muted-foreground">
          Or: <span className="font-mono">npm run db:deploy</span>
        </p>
        <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Back home
        </Link>
      </CardContent>
    </Card>
  );
}
