"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "gitpreflight.selectedOrgId";

export function useSelectedOrg(
  orgs: Array<{ org: { _id: string; name?: string }; role?: string }> | undefined
) {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      if (v) setSelectedOrgId(v);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!orgs || orgs.length === 0) return;
    if (selectedOrgId && orgs.some((o) => o.org._id === selectedOrgId)) return;
    setSelectedOrgId(orgs[0]!.org._id);
  }, [orgs, selectedOrgId]);

  useEffect(() => {
    if (!selectedOrgId) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, selectedOrgId);
    } catch {
      // ignore
    }
  }, [selectedOrgId]);

  const selectedOrgRecord = useMemo(() => {
    if (!orgs || !selectedOrgId) return null;
    return orgs.find((o) => o.org._id === selectedOrgId) ?? null;
  }, [orgs, selectedOrgId]);

  const selectedOrg = selectedOrgRecord?.org ?? null;
  const selectedOrgRole = selectedOrgRecord?.role ?? null;

  return { selectedOrgId, setSelectedOrgId, selectedOrg, selectedOrgRole, selectedOrgRecord };
}
