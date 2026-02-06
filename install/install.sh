#!/bin/sh

set -eu

REPO="${GITPREFLIGHT_GITHUB_REPO:-un/gitpreflight}"
INSTALL_DIR="${GITPREFLIGHT_INSTALL_DIR:-${HOME}/.local/bin}"

say() { printf '%s\n' "$*"; }
die() { printf '%s\n' "$*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

need_cmd curl
need_cmd uname
need_cmd chmod
need_cmd mkdir

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin) PLATFORM="darwin" ;;
  Linux) PLATFORM="linux" ;;
  *) die "Unsupported OS: $OS (supported: macOS, Linux)" ;;
esac

case "$ARCH" in
  x86_64|amd64) CPU="x64" ;;
  arm64|aarch64) CPU="arm64" ;;
  *) die "Unsupported arch: $ARCH (supported: x64, arm64)" ;;
esac

VERSION="${GITPREFLIGHT_INSTALL_VERSION:-}"
if [ -z "$VERSION" ]; then
  # Resolve latest tag via GitHub redirect.
  VERSION="$(curl -fsSLI "https://github.com/${REPO}/releases/latest" \
    | tr -d '\r' \
    | awk -F'/' 'tolower($1) ~ /^location:$/ {print $NF; exit 0}')"
fi

if [ -z "$VERSION" ]; then
  die "Failed to resolve latest GitPreflight version (set GITPREFLIGHT_INSTALL_VERSION to pin)"
fi

ASSET="gitpreflight-${VERSION}-${PLATFORM}-${CPU}"
BASE_URL="https://github.com/${REPO}/releases/download/${VERSION}"
ASSET_URL="${BASE_URL}/${ASSET}"
CHECKSUMS_URL="${BASE_URL}/checksums.txt"

TMP_DIR="${TMPDIR:-/tmp}"
TMP_BIN="${TMP_DIR}/gitpreflight.$$"
TMP_SUMS="${TMP_DIR}/gitpreflight-checksums.$$"

cleanup() {
  rm -f "$TMP_BIN" "$TMP_SUMS" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

say "GitPreflight: downloading ${ASSET}..."
curl -fsSL "$ASSET_URL" -o "$TMP_BIN"
curl -fsSL "$CHECKSUMS_URL" -o "$TMP_SUMS"

EXPECTED="$(awk -v name="$ASSET" '$2==name {print $1; exit 0}' "$TMP_SUMS")"
if [ -z "$EXPECTED" ]; then
  die "Missing checksum for ${ASSET} in checksums.txt"
fi

ACTUAL=""
if command -v sha256sum >/dev/null 2>&1; then
  ACTUAL="$(sha256sum "$TMP_BIN" | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
  ACTUAL="$(shasum -a 256 "$TMP_BIN" | awk '{print $1}')"
else
  die "Missing sha256 tool (need sha256sum or shasum)"
fi

if [ "$EXPECTED" != "$ACTUAL" ]; then
  die "Checksum mismatch for ${ASSET}"
fi

mkdir -p "$INSTALL_DIR"
chmod 755 "$TMP_BIN"

DEST="${INSTALL_DIR}/gitpreflight"
mv "$TMP_BIN" "$DEST"
chmod 755 "$DEST"

say "GitPreflight installed to: ${DEST}"
say ""
say "Next:"
say "  gitpreflight --help"
say ""
say "If 'gitpreflight' is not found, add this to your shell profile:"
say "  export PATH=\"${INSTALL_DIR}:\$PATH\""
