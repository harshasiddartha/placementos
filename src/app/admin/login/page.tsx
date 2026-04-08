import Link from "next/link";

import { loginAdminAction } from "@/app/admin/login/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminTokenFromEnv } from "@/lib/admin-guard";

import { AdminLoginForm } from "./admin-login-form";

export default function AdminLoginPage() {
  const configured = Boolean(getAdminTokenFromEnv());

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin</CardTitle>
          <CardDescription>
            Enter the access token from{" "}
            <code className="text-xs">ADMIN_ACCESS_TOKEN</code> in your server
            environment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!configured ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Admin login is disabled until you set{" "}
              <code className="text-xs">ADMIN_ACCESS_TOKEN</code> in{" "}
              <code className="text-xs">.env</code>.
            </p>
          ) : (
            <AdminLoginForm action={loginAdminAction} />
          )}
          <Link
            href="/"
            className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Back to app
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
