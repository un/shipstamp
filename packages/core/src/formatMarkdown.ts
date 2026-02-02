import type { Finding, ReviewResult, Severity } from "./reviewTypes";

const SEVERITY_RANK: Record<Severity, number> = {
  major: 0,
  minor: 1,
  note: 2
};

function countSeverities(findings: Finding[]) {
  let note = 0;
  let minor = 0;
  let major = 0;

  for (const f of findings) {
    if (f.severity === "note") note++;
    else if (f.severity === "minor") minor++;
    else major++;
  }

  return { note, minor, major };
}

function fenceFor(content: string, base = "```") {
  let maxRun = 0;
  let current = 0;

  for (const ch of content) {
    if (ch === "`") {
      current++;
      if (current > maxRun) maxRun = current;
    } else {
      current = 0;
    }
  }

  const minLen = base.length;
  const len = Math.max(minLen, maxRun + 1);
  return "`".repeat(len);
}

function sortFindings(a: Finding, b: Finding) {
  const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (sev !== 0) return sev;

  const aLine = a.line ?? Number.POSITIVE_INFINITY;
  const bLine = b.line ?? Number.POSITIVE_INFINITY;
  if (aLine !== bLine) return aLine - bLine;

  return a.title.localeCompare(b.title);
}

export function formatReviewResultMarkdown(result: ReviewResult): string {
  const findings = [...result.findings];
  const counts = countSeverities(findings);

  const out: string[] = [];
  out.push("# Shipstamp Review");
  out.push("");
  out.push(`Result: ${result.status}`);
  out.push(`Counts: note=${counts.note} minor=${counts.minor} major=${counts.major}`);
  out.push("");
  out.push("## Findings");

  if (findings.length === 0) {
    out.push("");
    out.push("(none)");
    out.push("");
    return out.join("\n");
  }

  const byPath = new Map<string, Finding[]>();
  for (const f of findings) {
    const arr = byPath.get(f.path) ?? [];
    arr.push(f);
    byPath.set(f.path, arr);
  }

  const paths = [...byPath.keys()].sort((a, b) => a.localeCompare(b));
  for (const path of paths) {
    const fileFindings = byPath.get(path) ?? [];
    fileFindings.sort(sortFindings);

    out.push("");
    out.push(`### ${path}`);

    for (const f of fileFindings) {
      out.push("");
      out.push(`#### ${f.title}`);
      out.push(`Path: ${f.path}`);
      if (typeof f.line === "number") out.push(`Line: ${f.line}`);
      out.push(`Severity: ${f.severity}`);

      const agreed = f.agreement?.agreed ?? 0;
      const total = f.agreement?.total ?? 0;
      out.push(`Agreement: ${agreed}/${total}`);
      out.push("");
      out.push(f.message.trimEnd());

      if (f.suggestion && f.suggestion.trim().length > 0) {
        const fence = fenceFor(f.suggestion);
        out.push("");
        out.push(`${fence}suggestion`);
        out.push(f.suggestion.trimEnd());
        out.push(fence);
      }
    }
  }

  out.push("");
  return out.join("\n");
}
