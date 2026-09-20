#!/usr/bin/env bash
# Install CocoaPods deps for the generated ios/ project.
# Safe to re-run after prebuild or native module changes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d ios ]]; then
  echo "ios/ missing. Run: npx expo prebuild --platform ios" >&2
  exit 1
fi

if ! command -v pod >/dev/null 2>&1; then
  echo "CocoaPods not found. Install with: brew install cocoapods" >&2
  exit 1
fi

# Corporate TLS interceptors (e.g. Socket Firewall) break Ruby/OpenSSL trust
# for cdn.cocoapods.org and GitHub unless the proxy CA is in the bundle.
if [[ -z "${SSL_CERT_FILE:-}" ]]; then
  CANDIDATES=(
    "${HOME}/.claude/system-ca-certs.pem"
    "${NODE_EXTRA_CA_CERTS:-}"
    "/etc/ssl/cert.pem"
  )
  COMBINED="$(mktemp -t mobileflow-ca.XXXXXX.pem)"
  : >"$COMBINED"
  for c in "${CANDIDATES[@]}"; do
    [[ -n "$c" && -f "$c" ]] && cat "$c" >>"$COMBINED"
  done
  if [[ -s "$COMBINED" ]]; then
    export SSL_CERT_FILE="$COMBINED"
    export REQUESTS_CA_BUNDLE="$COMBINED"
    export CURL_CA_BUNDLE="$COMBINED"
    export GIT_SSL_CAINFO="$COMBINED"
    trap 'rm -f "$COMBINED"' EXIT
  else
    rm -f "$COMBINED"
  fi
fi

node "$ROOT/scripts/fix-pbxproj-shell-scripts.mjs"
cd ios
pod install
echo "Pods ready. Open ios/Mobileflow.xcworkspace (not the .xcodeproj)."
