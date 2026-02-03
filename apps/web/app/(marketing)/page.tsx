import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConvexHealth } from "../ConvexHealth";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
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
    </div>
  );
}
