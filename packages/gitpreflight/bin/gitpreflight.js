#!/usr/bin/env node

"use strict";

const { spawn } = require("node:child_process");
const { ensureGitPreflightBinary } = require("../lib/installer");

async function main() {
  const args = process.argv.slice(2);
  const { binPath } = await ensureGitPreflightBinary({ reason: "run" });

  const child = spawn(binPath, args, {
    stdio: "inherit",
    env: process.env
  });

  child.on("exit", (code, signal) => {
    if (typeof code === "number") process.exit(code);
    process.exitCode = 1;
    if (signal) {
      process.stderr.write(`GitPreflight exited due to signal: ${signal}\n`);
    }
  });

  child.on("error", (err) => {
    process.stderr.write(`Failed to start GitPreflight: ${err?.message ?? String(err)}\n`);
    process.exit(2);
  });
}

Promise.resolve(main()).catch((err) => {
  process.stderr.write(`GitPreflight installer error: ${err?.message ?? String(err)}\n`);
  process.exit(2);
});
