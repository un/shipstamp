import { detectPackageManager, type PackageManager } from "./packageManager";

function withHookUi(cmd: string): string {
  // Always force stable Markdown output inside hooks.
  return `SHIPSTAMP_HOOK=1 SHIPSTAMP_UI=plain ${cmd}`;
}

export function makeShipstampReviewHookLine(pm: PackageManager): string {
  if (pm === "pnpm") return withHookUi("pnpm exec shipstamp review --staged");
  if (pm === "npm") return withHookUi("npm exec -- shipstamp review --staged");
  if (pm === "yarn") return withHookUi("yarn -s shipstamp review --staged");
  if (pm === "bun") return withHookUi("bunx shipstamp review --staged");

  return withHookUi("npx --no-install shipstamp review --staged");
}

export function makeShipstampPushReviewHookLine(pm: PackageManager): string {
  // Pass through pre-push hook args (remote name + remote url).
  if (pm === "pnpm") return withHookUi("pnpm exec shipstamp review --push \"$@\"");
  if (pm === "npm") return withHookUi("npm exec -- shipstamp review --push \"$@\"");
  if (pm === "yarn") return withHookUi("yarn -s shipstamp review --push \"$@\"");
  if (pm === "bun") return withHookUi("bunx shipstamp review --push \"$@\"");

  return withHookUi("npx --no-install shipstamp review --push \"$@\"");
}

export function makeShipstampPostCommitHookLine(pm: PackageManager): string {
  if (pm === "pnpm") return withHookUi("pnpm exec shipstamp internal post-commit");
  if (pm === "npm") return withHookUi("npm exec -- shipstamp internal post-commit");
  if (pm === "yarn") return withHookUi("yarn -s shipstamp internal post-commit");
  if (pm === "bun") return withHookUi("bunx shipstamp internal post-commit");

  return withHookUi("npx --no-install shipstamp internal post-commit");
}

export function getShipstampPostCommitHookLine(repoRoot: string): string {
  const pm = detectPackageManager(repoRoot);
  return makeShipstampPostCommitHookLine(pm);
}

export function getShipstampReviewHookLine(repoRoot: string): string {
  const pm = detectPackageManager(repoRoot);
  return makeShipstampReviewHookLine(pm);
}

export function getShipstampPushReviewHookLine(repoRoot: string): string {
  const pm = detectPackageManager(repoRoot);
  return makeShipstampPushReviewHookLine(pm);
}
