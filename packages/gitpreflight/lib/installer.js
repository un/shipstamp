"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const https = require("node:https");
const crypto = require("node:crypto");

const DEFAULT_GITHUB_REPO = "un/gitpreflight";

function isTruthy(v) {
  return v === "1" || v === "true" || v === "yes";
}

function getPackageVersion() {
  try {
    return require("../package.json").version;
  } catch {
    return "0.0.0";
  }
}

function resolveTarget() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform !== "darwin" && platform !== "linux") {
    throw new Error(`Unsupported platform: ${platform}. GitPreflight supports macOS and Linux.`);
  }
  if (arch !== "x64" && arch !== "arm64") {
    throw new Error(`Unsupported architecture: ${arch}. GitPreflight supports x64 and arm64.`);
  }

  return { platform, arch };
}

function resolveCachePaths(version) {
  const home = os.homedir();
  const base = process.env.GITPREFLIGHT_HOME && process.env.GITPREFLIGHT_HOME.trim()
    ? process.env.GITPREFLIGHT_HOME.trim()
    : path.join(home, ".gitpreflight");

  const dir = path.join(base, "bin", version);
  const binPath = path.join(dir, "gitpreflight");
  return { dir, binPath };
}

function request(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const client = u.protocol === "https:" ? https : u.protocol === "http:" ? http : null;
    if (!client) {
      reject(new Error(`Unsupported URL protocol: ${u.protocol}`));
      return;
    }

    const req = client.get(
      u,
      {
        headers: {
          "user-agent": "gitpreflight-installer",
          accept: "application/octet-stream"
        }
      },
      (res) => {
        resolve(res);
      }
    );

    req.setTimeout(30_000, () => {
      req.destroy(new Error(`Timeout downloading ${url}`));
    });

    req.on("error", reject);
  });
}

async function downloadText(url, maxRedirects = 5) {
  const res = await request(url);

  if (
    (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) &&
    res.headers.location &&
    maxRedirects > 0
  ) {
    res.resume();
    const next = new URL(res.headers.location, url).toString();
    return downloadText(next, maxRedirects - 1);
  }

  if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
    const body = await streamToString(res);
    throw new Error(`HTTP ${res.statusCode ?? "?"} downloading ${url}${body ? `: ${body.trim()}` : ""}`);
  }

  return streamToString(res);
}

async function downloadFile(url, destPath, maxRedirects = 5) {
  const res = await request(url);

  if (
    (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) &&
    res.headers.location &&
    maxRedirects > 0
  ) {
    res.resume();
    const next = new URL(res.headers.location, url).toString();
    return downloadFile(next, destPath, maxRedirects - 1);
  }

  if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
    const body = await streamToString(res);
    throw new Error(`HTTP ${res.statusCode ?? "?"} downloading ${url}${body ? `: ${body.trim()}` : ""}`);
  }

  await fsp.mkdir(path.dirname(destPath), { recursive: true });

  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(destPath);
    res.pipe(out);
    res.on("error", reject);
    out.on("error", reject);
    out.on("finish", resolve);
  });
}

function streamToString(stream) {
  return new Promise((resolve, reject) => {
    let data = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      data += chunk;
    });
    stream.on("error", reject);
    stream.on("end", () => resolve(data));
  });
}

async function sha256File(absPath) {
  const h = crypto.createHash("sha256");
  await new Promise((resolve, reject) => {
    const s = fs.createReadStream(absPath);
    s.on("data", (chunk) => h.update(chunk));
    s.on("error", reject);
    s.on("end", resolve);
  });
  return h.digest("hex");
}

function parseChecksums(text) {
  const lines = text.split(/\r?\n/);
  const map = new Map();
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(/^([a-f0-9]{64})\s{2}(.+)$/i);
    if (!m) continue;
    map.set(m[2].trim(), m[1].toLowerCase());
  }
  return map;
}

async function fileExists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function chmod755(p) {
  try {
    await fsp.chmod(p, 0o755);
  } catch {
    // best-effort
  }
}

async function ensureGitPreflightBinary(opts) {
  const version = (process.env.GITPREFLIGHT_INSTALL_VERSION && process.env.GITPREFLIGHT_INSTALL_VERSION.trim()) || getPackageVersion();
  const repo = (process.env.GITPREFLIGHT_GITHUB_REPO && process.env.GITPREFLIGHT_GITHUB_REPO.trim()) || DEFAULT_GITHUB_REPO;

  const baseUrlOverride = process.env.GITPREFLIGHT_INSTALL_BASE_URL && process.env.GITPREFLIGHT_INSTALL_BASE_URL.trim()
    ? process.env.GITPREFLIGHT_INSTALL_BASE_URL.trim().replace(/\/+$/, "")
    : null;

  if (!version) {
    throw new Error("Could not determine GitPreflight version to install");
  }

  if (version === "0.0.0" && !baseUrlOverride) {
    throw new Error(
      "GitPreflight is running from a source checkout (version 0.0.0). " +
        "Build from source, or set GITPREFLIGHT_INSTALL_VERSION to a released version."
    );
  }

  const { platform, arch } = resolveTarget();
  const assetName = `gitpreflight-v${version}-${platform}-${arch}`;
  const base = baseUrlOverride ?? `https://github.com/${repo}/releases/download/v${version}`;
  const assetUrl = `${base}/${assetName}`;
  const checksumsUrl = `${base}/checksums.txt`;

  const { dir, binPath } = resolveCachePaths(version);
  if (await fileExists(binPath)) {
    return { binPath, version, platform, arch, assetName, repo, cached: true };
  }

  await fsp.mkdir(dir, { recursive: true });
  const tmpPath = path.join(dir, `gitpreflight.tmp-${process.pid}-${Date.now()}`);

  if (!isTruthy(process.env.GITPREFLIGHT_QUIET_INSTALL) && opts?.reason !== "postinstall") {
    process.stderr.write(`GitPreflight: downloading ${assetName}...\n`);
  }

  await downloadFile(assetUrl, tmpPath);

  const checksumsText = await downloadText(checksumsUrl);
  const checksums = parseChecksums(checksumsText);
  const expected = checksums.get(assetName);
  if (!expected) {
    throw new Error(`Missing checksum for ${assetName} in checksums.txt`);
  }

  const actual = await sha256File(tmpPath);
  if (actual !== expected) {
    throw new Error(`Checksum mismatch for ${assetName} (expected ${expected}, got ${actual})`);
  }

  await chmod755(tmpPath);
  await fsp.rename(tmpPath, binPath);
  await chmod755(binPath);

  return { binPath, version, platform, arch, assetName, repo, cached: false };
}

module.exports = {
  ensureGitPreflightBinary
};
