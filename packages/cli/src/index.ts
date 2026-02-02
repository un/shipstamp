import { SHIPSTAMP_CORE_VERSION } from "@shipstamp/core";

export function main(argv: string[] = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write("shipstamp (stub)\n\nThis is a scaffold; CLI commands land in a later step.\n");
    return 0;
  }

  process.stdout.write(`shipstamp (stub) — core ${SHIPSTAMP_CORE_VERSION}\n`);
  return 0;
}

if (require.main === module) {
  const code = main();
  process.exitCode = code;
}
