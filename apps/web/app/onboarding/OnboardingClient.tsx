"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function normalizeInviteCode(code: string) {
  return code.trim().toUpperCase();
}

export function OnboardingClient() {
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();

  const orgs = useQuery(api.orgs.listMine, isConvexAuthenticated ? undefined : "skip");
  const invites = useQuery(api.invites.listForMyEmail, isConvexAuthenticated ? undefined : "skip");

  const createOrg = useMutation(api.orgs.create);
  const acceptInvite = useMutation(api.invites.acceptByCode);

  const [orgName, setOrgName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const normalizedCode = useMemo(() => normalizeInviteCode(inviteCode), [inviteCode]);

  useEffect(() => {
    // Best-effort welcome email (server decides whether to send).
    fetch("/api/v1/emails/welcome", { method: "POST" }).catch(() => {});

    // Pre-fill invite code if present.
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code && code.trim().length > 0) {
      setInviteCode(code);
    }
  }, []);

  if (orgs === undefined || invites === undefined) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </main>
    );
  }

  if (orgs.length > 0) {
    // Already onboarded.
    if (typeof window !== "undefined") {
      window.location.href = "/dashboard";
    }
    return null;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
      <div>
        <div className="text-2xl font-semibold">Welcome to Shipstamp</div>
        <div className="text-sm text-muted-foreground">Create an org or join one via invite.</div>
      </div>

      {invites.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending invites</CardTitle>
            <CardDescription>We found org invites for your email address.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {invites.map(({ invite, org }) => (
              <div
                key={invite._id}
                className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">{org.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Invite code: <span className="font-mono">{invite.code}</span>
                  </div>
                </div>
                <Button
                  onClick={async () => {
                    setStatus(null);
                    try {
                      await acceptInvite({ code: invite.code });
                      window.location.href = "/dashboard";
                    } catch (err) {
                      setStatus((err as Error).message);
                    }
                  }}
                >
                  Accept
                </Button>
              </div>
            ))}
            <div className="text-xs text-muted-foreground">
              You can skip invites for now and create your own org below.
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Join with invite code</CardTitle>
          <CardDescription>Enter an invite code to join an org.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="ABCDE-FGHIJ" />
          <Button
            variant="outline"
            onClick={async () => {
              setStatus(null);
              try {
                await acceptInvite({ code: normalizedCode });
                window.location.href = "/dashboard";
              } catch (err) {
                setStatus((err as Error).message);
              }
            }}
          >
            Join org
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create an org</CardTitle>
          <CardDescription>You can create an org if you haven’t been invited yet.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Unproprietary" />
          <Button
            onClick={async () => {
              setStatus(null);
              try {
                await createOrg({ name: orgName.trim() });
                window.location.href = "/dashboard";
              } catch (err) {
                setStatus((err as Error).message);
              }
            }}
          >
            Create org
          </Button>
        </CardContent>
      </Card>

      {status ? <div className="text-sm text-destructive">{status}</div> : null}
    </main>
  );
}
