import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
              <Button>Run shipstamp init</Button>
              <Button variant="outline">Review staged changes</Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
