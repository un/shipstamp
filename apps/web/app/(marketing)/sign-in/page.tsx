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
    <div className="mx-auto w-full max-w-md">
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
    </div>
  );
}
