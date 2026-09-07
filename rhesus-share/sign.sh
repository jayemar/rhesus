#!/usr/bin/env bash
# Signs rhesus-share via AMO using credentials from .env, copies the signed
# .xpi into the running rhesus-server container (if reachable), and prints
# the remaining manual steps.
# See .env.example for the required/optional variables and
# RHESUS-SHARE-BUILD-AND-DEPLOY.md for the full build/deploy flow.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

if [ ! -f .env ]; then
  echo "error: .env not found in $script_dir (copy .env.example to .env and fill it in)" >&2
  exit 1
fi

set -a
source .env
set +a

if [ -z "${AMO_JWT_ISSUER:-}" ] || [ -z "${AMO_JWT_SECRET:-}" ]; then
  echo "error: AMO_JWT_ISSUER and AMO_JWT_SECRET must both be set in .env" >&2
  exit 1
fi

docker_container="${DOCKER_CONTAINER:-ttrss-rhesus-server-1}"
nginx_xpi_path="${NGINX_XPI_PATH:-/usr/share/nginx/html/rhesus-share.xpi}"

version="$(node -e "console.log(require('./manifest.json').version)")"
sign_log="$(mktemp)"
trap 'rm -f "$sign_log"' EXIT

set +e
npx web-ext sign --api-key="$AMO_JWT_ISSUER" --api-secret="$AMO_JWT_SECRET" --channel=unlisted >"$sign_log" 2>&1
sign_status=$?
set -e

if [ "$sign_status" -eq 0 ]; then
  xpi="$(ls -t web-ext-artifacts/*.xpi | head -n 1)"
  echo "signed: $xpi"
elif grep -q "already exists" "$sign_log"; then
  echo "AMO already has a signed build for version $version - nothing new to sign, reusing it."
  xpi="$(ls -t web-ext-artifacts/*-"$version".xpi 2>/dev/null | head -n 1)"
  if [ -z "$xpi" ]; then
    echo "error: no local .xpi found for version $version in web-ext-artifacts/." >&2
    echo "Bump 'version' in manifest.json and re-run ./sign.sh, or locate the previously-signed .xpi manually." >&2
    exit 1
  fi
  echo "using existing signed file: $xpi"
elif grep -q "already been submitted" "$sign_log"; then
  echo "error: AMO already received this exact build (byte-for-byte) from an earlier run that didn't finish," >&2
  echo "and refuses a duplicate upload while it's outstanding. No local .xpi was produced this time." >&2
  echo >&2
  echo "Try one of:" >&2
  echo "  - Wait a couple of minutes for the earlier upload to finish processing on AMO, then re-run ./sign.sh." >&2
  echo "  - Check your AMO developer dashboard for a version $version build that already finished signing," >&2
  echo "    and download it from there instead." >&2
  echo "  - Make any trivial source change and bump 'version' in manifest.json, then re-run ./sign.sh." >&2
  exit 1
else
  echo "error: web-ext sign failed:" >&2
  cat "$sign_log" >&2
  exit 1
fi

if command -v docker >/dev/null 2>&1 && docker inspect "$docker_container" >/dev/null 2>&1; then
  docker cp "$xpi" "$docker_container:$nginx_xpi_path"
  echo "copied to $docker_container:$nginx_xpi_path"
else
  echo "warning: docker container '$docker_container' not found or docker not available - copy $xpi to the server manually" >&2
fi

cat <<EOF

Next steps on the Firefox for Android device:
  1. Download the .xpi from the homelab nginx URL (the /rhesus-share.xpi location, over Tailscale).
  2. Settings -> "Install Extension from File" -> browse to the downloaded file -> tap "Add".
EOF
