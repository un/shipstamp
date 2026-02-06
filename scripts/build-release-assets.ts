import { createReadStream, mkdirSync, writeFileSync } from "node:fs";
import { chmod } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

type TargetKey = "darwin-arm64" | "darwin-x64" | "linux-arm64" | "linux-x64";

const TARGETS: Record<TargetKey, { bunTarget: string; platform: string; arch: string }> = {
  "darwin-arm64": { bunTarget: "bun-darwin-arm64", platform: "darwin", arch: "arm64" },
  "darwin-x64": { bunTarget: "bun-darwin-x64", platform: "darwin", arch: "x64" },
  "linux-arm64": { bunTarget: "bun-linux-arm64", platform: "linux", arch: "arm64" },
  "linux-x64": { bunTarget: "bun-linux-x64", platform: "linux", arch: "x64" }
};

function parseArgValue(argv: string[], name: string): string | null {
  const direct = argv.find((a) => a.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);

  const idx = argv.indexOf(name);
  if (idx === -1) return null;
  return argv[idx + 1] ?? null;
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

async function sha256File(absPath: string): Promise<string> {
  const h = createHash("sha256");

  await new Promise<void>((resolvePromise, reject) => {
    const s = createReadStream(absPath);
    s.on("data", (chunk) => h.update(chunk));
    s.on("error", reject);
    s.on("end", () => resolvePromise());
  });

  return h.digest("hex");
}

async function main() {
  const argv = process.argv.slice(2);

  const version = process.env.GITPREFLIGHT_VERSION?.trim() || "0.0.0";
  const official = hasFlag(argv, "--official");

  const outDir = resolve(parseArgValue(argv, "--outdir") ?? "dist/release");
  mkdirSync(outDir, { recursive: true });

  const targetsArg = parseArgValue(argv, "--targets");
  const hostKey = `${process.platform}-${process.arch}` as TargetKey;
  const defaultTargets = hostKey in TARGETS ? [hostKey] : [];
  const targetKeys: TargetKey[] = (targetsArg ? targetsArg.split(",") : defaultTargets) as any;

  if (targetKeys.length === 0) {
    throw new Error(
      `Unsupported host target (${process.platform}/${process.arch}). Use --targets and one of: ${Object.keys(TARGETS).join(", ")}`
    );
  }

  for (const t of targetKeys) {
    if (!(t in TARGETS)) {
      throw new Error(`Unknown target: ${t}. Expected one of: ${Object.keys(TARGETS).join(", ")}`);
    }
  }

  // 1) Build JS bundle with compile-time flags.
  const buildCmd = official ? "build:official" : "build";
  const build = Bun.spawnSync({
    cmd: ["bun", "run", buildCmd],
    cwd: resolve("packages/cli"),
    env: { ...process.env, GITPREFLIGHT_VERSION: version },
    stdout: "inherit",
    stderr: "inherit"
  });
  if (build.exitCode !== 0) {
    throw new Error(`Failed to build @gitpreflight/cli (${buildCmd})`);
  }

  const entry = resolve("packages/cli/dist/index.js");
  const checksumLines: string[] = [];

  // 2) Compile per target.
  for (const t of targetKeys) {
    const { bunTarget, platform, arch } = TARGETS[t];
    const filename = `gitpreflight-v${version}-${platform}-${arch}`;
    const outFile = join(outDir, filename);

    const res = Bun.spawnSync({
      cmd: [
        "bun",
        "build",
        "--compile",
        "--no-compile-autoload-dotenv",
        "--no-compile-autoload-bunfig",
        "--no-compile-autoload-tsconfig",
        "--no-compile-autoload-package-json",
        `--target=${bunTarget}`,
        `--outfile=${outFile}`,
        entry
      ],
      cwd: resolve("."),
      stdout: "inherit",
      stderr: "inherit"
    });

    if (res.exitCode !== 0) {
      throw new Error(`Failed to compile ${filename} (${bunTarget})`);
    }

    await chmod(outFile, 0o755);
    const sum = await sha256File(outFile);
    checksumLines.push(`${sum}  ${filename}`);
  }

  writeFileSync(join(outDir, "checksums.txt"), `${checksumLines.join("\n")}\n`, "utf8");
  process.stdout.write(`Wrote ${checksumLines.length} binaries + checksums to ${outDir}\n`);
}

main().catch((err) => {
  process.stderr.write(`${(err as Error).message}\n`);
  process.exitCode = 1;
});
