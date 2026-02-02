import { isAuthenticated, fetchAuthQuery } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "../../../../../../convex/_generated/api";

export default async function RepoPage({ params }: { params: { repoId: string } }) {
  const ok = await isAuthenticated();
  if (!ok) redirect("/sign-in");

  const repo = await fetchAuthQuery(api.repos.get, { repoId: params.repoId as any } as any);
  if (!repo) redirect("/dashboard/repos");

  const branches = await fetchAuthQuery(
    api.reviews.listBranchesForRepo,
    { repoId: params.repoId as any, limit: 200 } as any
  );
  const runs = await fetchAuthQuery(api.reviews.listRecentForRepo, { repoId: params.repoId as any, limit: 20 } as any);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Repo</div>
            <div className="text-sm text-muted-foreground">{repo.normalizedOriginUrl}</div>
          </div>
          <Link href="/dashboard/repos" className={buttonVariants({ variant: "outline" })}>
            Back
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>Repo metadata</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Origin:</span> {repo.originUrl}
              </div>
              <div>
                <span className="text-muted-foreground">Default branch:</span> {repo.defaultBranch}
              </div>
              <div>
                <span className="text-muted-foreground">Created:</span> {new Date(repo.createdAtMs).toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Branches</CardTitle>
            <CardDescription>Latest status per branch</CardDescription>
          </CardHeader>
          <CardContent>
            {branches.length === 0 ? (
              <div className="text-sm text-muted-foreground">No branch activity yet.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {branches.map((b) => (
                  <div key={b.branch} className="rounded-md border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{b.branch}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {new Date(b.latest.createdAtMs).toLocaleString()} · {b.latest.status}
                          {b.latest.durationMs != null ? ` · ${b.latest.durationMs}ms` : ""}
                        </div>
                      </div>
                      <div className="shrink-0 text-xs text-muted-foreground">
                        {b.uncheckedCount > 0 ? `${b.uncheckedCount} unchecked · ` : ""}
                        {b.totalRuns} runs
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unchecked backlog</CardTitle>
            <CardDescription>Branches with recent UNCHECKED runs</CardDescription>
          </CardHeader>
          <CardContent>
            {branches.filter((b) => b.uncheckedCount > 0).length === 0 ? (
              <div className="text-sm text-muted-foreground">No unchecked runs recorded.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {branches
                  .filter((b) => b.uncheckedCount > 0)
                  .map((b) => (
                    <div key={b.branch} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                      <div className="min-w-0 truncate font-medium">{b.branch}</div>
                      <div className="shrink-0 text-xs text-muted-foreground">{b.uncheckedCount} unchecked</div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent runs</CardTitle>
            <CardDescription>Last 20</CardDescription>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <div className="text-sm text-muted-foreground">No runs yet.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {runs.map((r) => (
                  <Link
                    key={r.run._id}
                    href={`/dashboard/runs/${r.run._id}`}
                    className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{r.run.branch}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {new Date(r.run.createdAtMs).toLocaleString()} · {r.run.status}
                          {r.run.durationMs != null ? ` · ${r.run.durationMs}ms` : ""}
                        </div>
                      </div>
                      <div className="shrink-0 text-xs text-muted-foreground">
                        {r.counts.major} major · {r.counts.minor} minor · {r.counts.note} note
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
