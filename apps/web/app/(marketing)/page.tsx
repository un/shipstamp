import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConvexHealth } from "../ConvexHealth";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Shipstamp</CardTitle>
            <CardDescription>Staged-only pre-commit reviews for AI agents.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="text-sm text-muted-foreground">
              This page renders coss ui components installed via the shadcn CLI.
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/sign-in" className={buttonVariants({ variant: "default" })}>
                Sign in
              </Link>
              <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
                Dashboard
              </Link>
            </div>
          </CardContent>
        </Card>

        <ConvexHealth />
      </main>
    </div>
  );
}
