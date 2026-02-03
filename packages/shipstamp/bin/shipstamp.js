#!/usr/bin/env node

"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");
const { ensureShipstampBinary } = require("../lib/installer");

async function main() {
  const args = process.argv.slice(2);
  const { binPath } = await ensureShipstampBinary({ reason: "run" });

  const child = spawn(binPath, args, {
    stdio: "inherit",
    env: process.env
  });

  child.on("exit", (code, signal) => {
    if (typeof code === "number") process.exit(code);
    process.exitCode = 1;
    if (signal) {
      process.stderr.write(`Shipstamp exited due to signal: ${signal}\n`);
    }
  });

  child.on("error", (err) => {
    process.stderr.write(`Failed to start Shipstamp: ${err?.message ?? String(err)}\n`);
    process.exit(2);
  });
}

Promise.resolve(main()).catch((err) => {
  process.stderr.write(`Shipstamp installer error: ${err?.message ?? String(err)}\n`);
  process.exit(2);
});
