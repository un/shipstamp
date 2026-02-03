"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export default function DevicePage() {
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const session = authClient.useSession();
  const approve = useMutation(api.deviceAuth.approve);
  const acceptInvite = useMutation(api.invites.acceptByCode);
  const createOrg = useMutation(api.orgs.create);

  const canQuery = Boolean(session.data) && isConvexAuthenticated;
  const orgs = useQuery(api.orgs.listMine, canQuery ? undefined : "skip");
  const invites = useQuery(api.invites.listForMyEmail, canQuery ? undefined : "skip");

  const [code, setCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [orgName, setOrgName] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);

  const normalized = useMemo(() => code.trim().toUpperCase(), [code]);
  const normalizedInvite = useMemo(() => inviteCode.trim().toUpperCase(), [inviteCode]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Device Login</CardTitle>
            <CardDescription>Enter the code shown in your terminal to authorize the CLI.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!session.data ? (
              <>
                <Button
                  onClick={async () => {
                    await authClient.signIn.social({
                      provider: "github",
                      callbackURL: "/device"
                    });
                  }}
                >
                  Sign in with GitHub
                </Button>
                <Link href="/" className={buttonVariants({ variant: "ghost" })}>
                  Back
                </Link>
              </>
            ) : (
              <>
                {orgs === undefined || invites === undefined ? (
                  <div className="text-sm text-muted-foreground">Loading...</div>
                ) : orgs.length === 0 ? (
                  <div className="flex flex-col gap-3">
                    {invites.length > 0 ? (
                      <div className="rounded-lg border bg-card px-4 py-3">
                        <div className="text-sm font-medium">Pending invites</div>
                        <div className="mt-2 flex flex-col gap-2">
                          {invites.map(({ invite, org }) => (
                            <Button
                              key={invite._id}
                              variant="outline"
                              onClick={async () => {
                                setStatus(null);
                                try {
                                  await acceptInvite({ code: invite.code });
                                } catch (err) {
                                  setStatus((err as Error).message);
                                }
                              }}
                            >
                              Accept {org.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-lg border bg-card px-4 py-3">
                      <div className="text-sm font-medium">Join with invite code</div>
                      <div className="mt-2 flex flex-col gap-2">
                        <Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="ABCDE-FGHIJ" />
                        <Button
                          variant="outline"
                          onClick={async () => {
                            setStatus(null);
                            try {
                              await acceptInvite({ code: normalizedInvite });
                            } catch (err) {
                              setStatus((err as Error).message);
                            }
                          }}
                        >
                          Join org
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-lg border bg-card px-4 py-3">
                      <div className="text-sm font-medium">Create an org</div>
                      <div className="mt-2 flex flex-col gap-2">
                        <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Unproprietary" />
                        <Button
                          onClick={async () => {
                            setStatus(null);
                            try {
                              await createOrg({ name: orgName.trim() });
                            } catch (err) {
                              setStatus((err as Error).message);
                            }
                          }}
                        >
                          Create org
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="text-xs text-muted-foreground">Select an org for this CLI token</div>
                    <select
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      value={selectedOrgId || orgs[0]!.org._id}
                      onChange={(e) => setSelectedOrgId(e.target.value)}
                    >
                      {orgs.map(({ org }) => (
                        <option key={org._id} value={org._id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="ABCD-EFGH"
                  autoCapitalize="characters"
                />
                <Button
                  onClick={async () => {
                    setStatus(null);
                    try {
                      if (!orgs || orgs.length === 0) {
                        setStatus("You need to join or create an org first.");
                        return;
                      }
                      const orgId = selectedOrgId || orgs[0]!.org._id;
                      await approve({ userCode: normalized, orgId });
                      setStatus("Approved. You can return to the CLI.");
                    } catch {
                      setStatus("Failed to approve code.");
                    }
                  }}
                >
                  Approve
                </Button>
                {status ? <div className="text-sm text-muted-foreground">{status}</div> : null}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
