"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const [busy, setBusy] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Authenticate with GitHub to access Shipstamp.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await authClient.signIn.social({
                  provider: "github",
                  callbackURL: "/dashboard"
                });
              }}
            >
              Continue with GitHub
            </Button>
            <Link href="/" className={buttonVariants({ variant: "ghost" })}>
              Back
            </Link>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
