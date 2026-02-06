import type { Finding, Severity } from "@gitpreflight/core";

const SEV_RANK: Record<Severity, number> = { note: 0, minor: 1, major: 2 };

function maxSeverity(a: Severity, b: Severity): Severity {
  return SEV_RANK[a] >= SEV_RANK[b] ? a : b;
}

function signature(f: Finding): string {
  const line = typeof f.line === "number" ? String(f.line) : "";
  const title = f.title.trim().toLowerCase();
  const path = f.path.trim();
  const sugg = (f.suggestion ?? "").trim();
  // Keep it stable but not huge.
  const suggSig = sugg ? `|s:${sugg.slice(0, 80)}` : "";
  return `${path}|${line}|${title}${suggSig}`;
}

export type PerModelFindings = {
  modelName: string;
  findings: Finding[];
};

export function mergeFindings(perModel: PerModelFindings[]): Finding[] {
  const totalModels = perModel.length;
  const byKey = new Map<
    string,
    {
      merged: Finding;
      modelVotes: Set<string>;
    }
  >();

  for (const model of perModel) {
    for (const f of model.findings) {
      const key = signature(f);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          merged: {
            ...f,
            agreement: { agreed: 1, total: totalModels }
          },
          modelVotes: new Set([model.modelName])
        });
        continue;
      }

      existing.modelVotes.add(model.modelName);
      existing.merged.severity = maxSeverity(existing.merged.severity, f.severity);

      // Prefer longer message if they differ.
      if ((f.message?.length ?? 0) > (existing.merged.message?.length ?? 0)) {
        existing.merged.message = f.message;
      }

      // Prefer suggestion if existing doesn't have one.
      if (!existing.merged.suggestion && f.suggestion) {
        existing.merged.suggestion = f.suggestion;
      }
    }
  }

  const merged = [...byKey.values()].map((v) => {
    v.merged.agreement = { agreed: v.modelVotes.size, total: totalModels };
    v.merged.modelVotes = [...v.modelVotes].sort((a, b) => a.localeCompare(b));
    return v.merged;
  });

  // Stable ordering: path, severity desc, line, title.
  const rank: Record<Severity, number> = { major: 0, minor: 1, note: 2 };
  merged.sort((a, b) => {
    const p = a.path.localeCompare(b.path);
    if (p !== 0) return p;
    const s = rank[a.severity] - rank[b.severity];
    if (s !== 0) return s;
    const al = a.line ?? Number.POSITIVE_INFINITY;
    const bl = b.line ?? Number.POSITIVE_INFINITY;
    if (al !== bl) return al - bl;
    return a.title.localeCompare(b.title);
  });

  return merged;
}
