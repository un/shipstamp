#!/usr/bin/env node

"use strict";

const { ensureGitPreflightBinary } = require("../lib/installer");

async function main() {
  const interactive = Boolean(process.stdout.isTTY) && Boolean(process.stderr.isTTY) && process.env.CI !== "1" && process.env.CI !== "true";

  if (process.env.GITPREFLIGHT_SKIP_DOWNLOAD === "1" || process.env.GITPREFLIGHT_SKIP_DOWNLOAD === "true") {
    if (interactive) {
      process.stderr.write("GitPreflight: run `gitpreflight install` to choose setup mode (global, local, or repo).\n");
    }
    return;
  }

  // Avoid noisy downloads during local development (workspace version is usually 0.0.0).
  if (!process.env.GITPREFLIGHT_INSTALL_VERSION) {
    try {
      const version = require("../package.json").version;
      if (version === "0.0.0") {
        if (interactive) {
          process.stderr.write("GitPreflight: run `gitpreflight install` to choose setup mode (global, local, or repo).\n");
        }
        return;
      }
    } catch {
      return;
    }
  }

  await ensureGitPreflightBinary({ reason: "postinstall" });

  if (interactive) {
    process.stderr.write("GitPreflight installed. Next: run `gitpreflight install` to configure hooks.\n");
  }
}

Promise.resolve(main()).catch((err) => {
  // Never fail install for transient network issues.
  process.stderr.write(`GitPreflight: postinstall download skipped (${err?.message ?? String(err)})\n`);
});
