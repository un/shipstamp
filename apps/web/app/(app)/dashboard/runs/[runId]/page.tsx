import { isAuthenticated, fetchAuthQuery } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@shipstamp/convex";

export default async function RunPage({ params }: { params: { runId: string } }) {
  const ok = await isAuthenticated();
  if (!ok) redirect("/sign-in");

  const data = await fetchAuthQuery(api.reviews.getRun, { runId: params.runId as any } as any);
  if (!data) redirect("/dashboard");

  const byPath = new Map<string, typeof data.findings>();
  for (const f of data.findings) {
    const arr = byPath.get(f.path) ?? [];
    arr.push(f);
    byPath.set(f.path, arr);
  }

  const paths = Array.from(byPath.keys()).sort((a, b) => a.localeCompare(b));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Review run</div>
            <div className="text-sm text-muted-foreground">{data.repo?.normalizedOriginUrl ?? "(unknown repo)"}</div>
          </div>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
            Back
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Run</CardTitle>
            <CardDescription>Metadata</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Status:</span> {data.run.status}
              </div>
              <div>
                <span className="text-muted-foreground">Branch:</span> {data.run.branch}
              </div>
              <div>
                <span className="text-muted-foreground">Plan:</span> {data.run.planTier}
              </div>
              <div>
                <span className="text-muted-foreground">Created:</span> {new Date(data.run.createdAtMs).toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Findings</CardTitle>
            <CardDescription>{data.findings.length} total</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {paths.length === 0 ? (
              <div className="text-sm text-muted-foreground">No findings.</div>
            ) : (
              paths.map((p) => (
                <div key={p} className="flex flex-col gap-2">
                  <div className="text-sm font-medium">{p}</div>
                  <div className="flex flex-col gap-2">
                    {(byPath.get(p) ?? []).map((f, idx) => (
                      <div key={`${p}:${idx}`} className="rounded-md border px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 font-medium">{f.title}</div>
                          <div className="shrink-0 text-xs text-muted-foreground">{f.severity}</div>
                        </div>
                        {f.line != null ? (
                          <div className="text-xs text-muted-foreground">Line: {f.line}</div>
                        ) : null}
                        <div className="whitespace-pre-wrap text-sm text-muted-foreground">{f.message}</div>
                        {f.suggestion ? (
                          <pre className="mt-2 overflow-auto rounded-md bg-muted px-3 py-2 text-xs">{f.suggestion}</pre>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
