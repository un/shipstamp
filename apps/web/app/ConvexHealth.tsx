"use client";

import { useQuery } from "convex/react";
import { api } from "@gitpreflight/convex";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ConvexHealth() {
  const result = useQuery(api.health.get);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Convex</CardTitle>
        <CardDescription>Dev deployment connection</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {!result ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : (
          <pre className="overflow-auto rounded-md bg-muted px-3 py-2 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
