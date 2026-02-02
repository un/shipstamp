#!/usr/bin/env node

"use strict";

const { runCli } = require("@shipstamp/cli");

const code = runCli(process.argv.slice(2));
process.exitCode = code;
