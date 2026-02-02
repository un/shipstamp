"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { api } from "../../../../convex/_generated/api";
import { useSelectedOrg } from "./useSelectedOrg";

export function DashboardClient() {
  const identity = useQuery(api.auth.getCurrentUser);
  const session = authClient.useSession();
  const orgs = useQuery(api.orgs.listMine);
  const { selectedOrgId, setSelectedOrgId, selectedOrg } = useSelectedOrg(orgs);
  const day = new Date().toISOString().slice(0, 10);
  const recent = useQuery(
    api.reviews.listRecentForOrg,
    selectedOrgId ? { orgId: selectedOrgId as any, limit: 10 } : "skip"
  );
  const myUsage = useQuery(
    api.usage.getMyDailyUsage,
    selectedOrgId ? { orgId: selectedOrgId as any, day } : "skip"
  );
  const orgUsage = useQuery(
    api.usage.getOrgDailyUsage,
    selectedOrgId ? { orgId: selectedOrgId as any, day } : "skip"
  );
  const modelStats = useQuery(
    api.stats.listModelStatsForOrgDay,
    selectedOrgId ? { orgId: selectedOrgId as any, day } : "skip"
  );
  const repos = useQuery(api.repos.listForOrg, selectedOrgId ? { orgId: selectedOrgId as any } : "skip");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/emails/welcome", { method: "POST" }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold">Dashboard</div>
            <div className="text-sm text-muted-foreground">Authenticated area</div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      window.location.href = "/";
                    }
                  }
                });
              }}
            >
              Sign out
            </Button>
            <Link href="/" className={buttonVariants({ variant: "ghost" })}>
              Home
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
            <CardDescription>Client session (Better Auth)</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-md bg-muted px-3 py-2 text-xs">
              {JSON.stringify(session.data ?? null, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Org</CardTitle>
            <CardDescription>Select which org to view</CardDescription>
          </CardHeader>
          <CardContent>
            {orgs === undefined ? (
              <div className="text-sm text-muted-foreground">Loading orgs...</div>
            ) : orgs.length === 0 ? (
              <div className="text-sm text-muted-foreground">No orgs yet.</div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <select
                  className="h-9 w-full max-w-md rounded-md border bg-background px-3 text-sm"
                  value={selectedOrgId ?? ""}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                >
                  {orgs.map((o) => (
                    <option key={o.org._id} value={o.org._id}>
                      {o.org.name}
                    </option>
                  ))}
                </select>
                <Link href="/dashboard/repos" className={buttonVariants({ variant: "outline" })}>
                  Repos
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>Server identity (Convex)</CardDescription>
          </CardHeader>
          <CardContent>
            {identity === undefined ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : (
              <pre className="overflow-auto rounded-md bg-muted px-3 py-2 text-xs">
                {JSON.stringify(identity, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent reviews</CardTitle>
            <CardDescription>Last 10 runs for {selectedOrg?.name ?? "your org"}</CardDescription>
          </CardHeader>
          <CardContent>
            {orgs === undefined ? (
              <div className="text-sm text-muted-foreground">Loading org...</div>
            ) : orgs.length === 0 ? (
              <div className="text-sm text-muted-foreground">No orgs yet.</div>
            ) : recent === undefined ? (
              <div className="text-sm text-muted-foreground">Loading runs...</div>
            ) : recent.length === 0 ? (
              <div className="text-sm text-muted-foreground">No runs yet.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {recent.map((r) => (
                  <Link
                    key={r.run._id}
                    href={`/dashboard/runs/${r.run._id}`}
                    className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {r.repo?.normalizedOriginUrl ?? "(unknown repo)"} · {r.run.branch}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {new Date(r.run.createdAtMs).toLocaleString()} · {r.run.status}
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

        <Card>
          <CardHeader>
            <CardTitle>Repos</CardTitle>
            <CardDescription>Repositories registered in this org</CardDescription>
          </CardHeader>
          <CardContent>
            {repos === undefined ? (
              <div className="text-sm text-muted-foreground">Loading repos...</div>
            ) : repos.length === 0 ? (
              <div className="text-sm text-muted-foreground">No repos yet (run `shipstamp review` once).</div>
            ) : (
              <div className="flex flex-col gap-2">
                {repos.slice(0, 8).map((r) => (
                  <Link
                    key={r._id}
                    href={`/dashboard/repos/${r._id}`}
                    className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 truncate font-medium">{r.normalizedOriginUrl}</div>
                      <div className="shrink-0 text-xs text-muted-foreground">{r.defaultBranch}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage today</CardTitle>
            <CardDescription>{day} (UTC)</CardDescription>
          </CardHeader>
          <CardContent>
            {myUsage === undefined || orgUsage === undefined ? (
              <div className="text-sm text-muted-foreground">Loading usage...</div>
            ) : (
              <div className="flex flex-col gap-1 text-sm">
                <div>
                  <span className="text-muted-foreground">You:</span> {myUsage.count}/{myUsage.limit} ({myUsage.remaining} left)
                </div>
                <div>
                  <span className="text-muted-foreground">Org:</span> {orgUsage.count}/{orgUsage.limit} ({orgUsage.remaining} left)
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Models today</CardTitle>
            <CardDescription>Per-model runs and findings</CardDescription>
          </CardHeader>
          <CardContent>
            {modelStats === undefined ? (
              <div className="text-sm text-muted-foreground">Loading model stats...</div>
            ) : modelStats.length === 0 ? (
              <div className="text-sm text-muted-foreground">No stats yet.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {modelStats.map((s) => (
                  <div key={s._id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0 truncate font-medium">{s.model}</div>
                    <div className="shrink-0 text-xs text-muted-foreground">
                      {s.runs} runs · {s.findings} findings{s.avgLatencyMs != null ? ` · ${s.avgLatencyMs}ms avg` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invite to org</CardTitle>
            <CardDescription>Generate an invite code (and email it if Resend is configured).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {orgs === undefined ? (
              <div className="text-sm text-muted-foreground">Loading orgs...</div>
            ) : orgs.length === 0 ? (
              <div className="text-sm text-muted-foreground">No orgs yet.</div>
            ) : (
              <>
                <div className="text-sm text-muted-foreground">Inviting into: {selectedOrg?.name ?? orgs[0]!.org.name}</div>
                <input
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@example.com"
                />
                <Button
                  variant="outline"
                  onClick={async () => {
                    setInviteStatus(null);
                    if (!selectedOrgId) {
                      setInviteStatus("Invite failed: missing selected org");
                      return;
                    }
                    const res = await fetch("/api/v1/orgs/invite", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ orgId: selectedOrgId, email: inviteEmail })
                    });

                    const txt = await res.text();
                    if (!res.ok) {
                      setInviteStatus(`Invite failed: ${txt}`);
                      return;
                    }

                    const data = JSON.parse(txt) as { inviteCode: string; emailed: boolean };
                    setInviteStatus(`Invite code: ${data.inviteCode}${data.emailed ? " (emailed)" : ""}`);
                  }}
                >
                  Create invite
                </Button>
                {inviteStatus ? <div className="text-sm text-muted-foreground">{inviteStatus}</div> : null}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
