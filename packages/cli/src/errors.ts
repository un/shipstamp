export type NetworkishError = {
  code?: string;
  name?: string;
  message?: string;
};

export function isOfflineOrTimeoutError(err: unknown): boolean {
  const e = err as NetworkishError;
  const code = typeof e?.code === "string" ? e.code : "";
  const name = typeof e?.name === "string" ? e.name : "";
  const message = typeof e?.message === "string" ? e.message : "";

  if (name === "AbortError") return true;

  const codes = new Set([
    "ETIMEDOUT",
    "ECONNRESET",
    "ECONNREFUSED",
    "ENOTFOUND",
    "EAI_AGAIN",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "EGITPREFLIGHT_SERVER"
  ]);
  if (codes.has(code)) return true;

  const m = message.toLowerCase();
  if (m.includes("timeout")) return true;
  if (m.includes("network")) return true;
  if (m.includes("failed to fetch")) return true;

  return false;
}
