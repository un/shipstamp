#!/usr/bin/env node

"use strict";

const { ensureShipstampBinary } = require("../lib/installer");

async function main() {
  if (process.env.SHIPSTAMP_SKIP_DOWNLOAD === "1" || process.env.SHIPSTAMP_SKIP_DOWNLOAD === "true") {
    return;
  }

  // Avoid noisy downloads during local development (workspace version is usually 0.0.0).
  if (!process.env.SHIPSTAMP_INSTALL_VERSION) {
    try {
      const version = require("../package.json").version;
      if (version === "0.0.0") return;
    } catch {
      return;
    }
  }

  await ensureShipstampBinary({ reason: "postinstall" });
}

Promise.resolve(main()).catch((err) => {
  // Never fail install for transient network issues.
  process.stderr.write(`Shipstamp: postinstall download skipped (${err?.message ?? String(err)})\n`);
});
