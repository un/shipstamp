"use client";

import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "../../../../../convex/_generated/api";
import { useSelectedOrg } from "../useSelectedOrg";

export function ReposClient() {
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const orgs = useQuery(api.orgs.listMine, isConvexAuthenticated ? undefined : "skip");
  const { selectedOrgId, setSelectedOrgId } = useSelectedOrg(orgs);
  const selectedOrgIdForQueries =
    selectedOrgId && orgs && orgs.some((o) => o.org._id === selectedOrgId) ? selectedOrgId : null;
  const repos = useQuery(
    api.repos.listForOrg,
    isConvexAuthenticated && selectedOrgIdForQueries ? { orgId: selectedOrgIdForQueries as any } : "skip"
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Repos</div>
            <div className="text-sm text-muted-foreground">Registered repositories</div>
          </div>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
            Back
          </Link>
        </div>

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
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Repositories</CardTitle>
            <CardDescription>Click a repo to see runs</CardDescription>
          </CardHeader>
          <CardContent>
            {repos === undefined ? (
              <div className="text-sm text-muted-foreground">Loading repos...</div>
            ) : repos.length === 0 ? (
              <div className="text-sm text-muted-foreground">No repos yet.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {repos.map((r) => (
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
      </main>
    </div>
  );
}
