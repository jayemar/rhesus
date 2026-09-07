#!/usr/bin/env bash
# Signs rhesus-share via AMO using credentials from .env, copies the signed
# .xpi to rhesus-share-<version>.xpi (this directory) and into the running
# rhesus-server container (if reachable), and prints the remaining manual
# steps.
#
# With -b/--bump-version, bumps the subminor version before doing anything
# else with the current one, then signs that. Otherwise, if AMO reports the
# current version as a conflict (already signed, or an earlier submission
# still outstanding), falls back to reusing a matching local file, then to
# fetching the already-signed build straight from AMO's API with the same
# credentials.
#
# See .env.example for the required/optional variables and
# RHESUS-SHARE-BUILD-AND-DEPLOY.md for the full build/deploy flow.

set -euo pipefail

bump_version=false
while [ $# -gt 0 ]; do
  case "$1" in
    -b|--bump-version)
      bump_version=true
      shift
      ;;
    -h|--help)
      cat <<EOF
Usage: ./sign-and-copy.sh [-b|--bump-version]

  -b, --bump-version  Bump the subminor version and rebuild. Useful if
                      current version is marked as already signed but
                      cannot be retrieved.
EOF
      exit 0
      ;;
    *)
      echo "error: unknown option '$1' (see --help)" >&2
      exit 1
      ;;
  esac
done

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
addon_id="$(node -e "console.log(require('./manifest.json').browser_specific_settings.gecko.id)")"

b64url() {
  openssl base64 -A | tr '+/' '-_' | tr -d '='
}

# Builds a short-lived (60s) HS256 JWT the same way web-ext itself does
# internally for AMO's API - no library needed, an HS256 JWT is just
# base64url(header).base64url(payload), HMAC-SHA256 signed.
make_amo_jwt() {
  local now exp jti header payload h64 p64 signing_input signature
  now=$(date +%s)
  exp=$((now + 60))
  jti="$now-$RANDOM"
  header='{"alg":"HS256","typ":"JWT"}'
  payload=$(printf '{"iss":"%s","jti":"%s","iat":%d,"exp":%d}' "$AMO_JWT_ISSUER" "$jti" "$now" "$exp")
  h64=$(printf '%s' "$header" | b64url)
  p64=$(printf '%s' "$payload" | b64url)
  signing_input="$h64.$p64"
  signature=$(printf '%s' "$signing_input" | openssl dgst -sha256 -hmac "$AMO_JWT_SECRET" -binary | b64url)
  printf '%s.%s' "$signing_input" "$signature"
}

# Tries to fetch an already-signed .xpi for the given version straight from
# AMO's own signing-status API - the same endpoint `web-ext sign` itself
# polls while waiting on a fresh submission, but nothing stops calling it
# directly for a version AMO already finished signing. Prints the
# downloaded file's path on success; prints nothing and returns non-zero on
# any failure (not signed yet, no network, credentials can't read it, AMO
# API shape changed, etc.) - callers should treat that as "couldn't fetch it
# this way," not a hard error.
fetch_signed_xpi() {
  local fetch_version="$1"
  local jwt response download_url out_file
  if ! command -v curl >/dev/null 2>&1; then
    return 1
  fi
  jwt="$(make_amo_jwt)"
  response="$(curl -sS -f -H "Authorization: JWT $jwt" \
    "https://addons.mozilla.org/api/v5/addons/addon/$addon_id/versions/$fetch_version/" 2>/dev/null)" || return 1
  download_url="$(printf '%s' "$response" | node -e '
    let d = "";
    process.stdin.on("data", c => d += c);
    process.stdin.on("end", () => {
      try {
        const j = JSON.parse(d);
        const f = (j.files || [])[0];
        if (f && f.download_url) process.stdout.write(f.download_url);
      } catch {}
    });
  ')"
  if [ -z "$download_url" ]; then
    return 1
  fi
  out_file="web-ext-artifacts/amo-fetched-$fetch_version.xpi"
  mkdir -p web-ext-artifacts
  if ! curl -sS -f -H "Authorization: JWT $jwt" -o "$out_file" "$download_url" 2>/dev/null || [ ! -s "$out_file" ]; then
    rm -f "$out_file"
    return 1
  fi
  printf '%s' "$out_file"
}

# Administrative bump only (no functional change) - just enough to give AMO
# a version number it hasn't seen before, so it accepts a fresh upload
# instead of conflicting. Not a semver-meaningful change on its own.
bump_patch_version() {
  node -e "
    const fs = require('fs');
    const m = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));
    const parts = m.version.split('.').map(Number);
    parts[2] = (parts[2] || 0) + 1;
    m.version = parts.join('.');
    fs.writeFileSync('./manifest.json', JSON.stringify(m, null, 2) + '\n');
    console.log(m.version);
  "
}

if [ "$bump_version" = true ]; then
  version="$(bump_patch_version)"
  echo "-b/--bump-version set: bumped manifest.json to $version before signing."
else
  version="$(node -e "console.log(require('./manifest.json').version)")"
fi

xpi=""
sign_log="$(mktemp)"
trap 'rm -f "$sign_log"' EXIT

set +e
npx web-ext sign --api-key="$AMO_JWT_ISSUER" --api-secret="$AMO_JWT_SECRET" --channel=unlisted >"$sign_log" 2>&1
sign_status=$?
set -e

if [ "$sign_status" -eq 0 ]; then
  # || true: under `set -e` + `pipefail`, a glob that matches nothing makes
  # `ls` exit non-zero, and pipefail promotes that to the whole pipeline's
  # exit status even though `head` itself succeeds - which would otherwise
  # abort the script right here, silently, before the `-z` check below ever
  # runs to report it properly.
  xpi="$(ls -t web-ext-artifacts/*.xpi 2>/dev/null | head -n 1 || true)"
  if [ -z "$xpi" ]; then
    echo "error: web-ext reported success but no .xpi appeared in web-ext-artifacts/." >&2
    exit 1
  fi
  echo "signed: $xpi"
else
  conflict=false
  if grep -q "already exists" "$sign_log"; then
    conflict=true
    echo "AMO already has a signed build for version $version - nothing new to sign."
  elif grep -q "already been submitted" "$sign_log"; then
    conflict=true
    echo "AMO already received this exact build from an earlier run that didn't finish, and refuses a duplicate upload while it's outstanding."
  fi

  if [ "$conflict" = false ]; then
    echo "error: web-ext sign failed:" >&2
    cat "$sign_log" >&2
    exit 1
  fi

  # Fallback 1: a local artifact from an earlier successful run.
  xpi="$(ls -t web-ext-artifacts/*-"$version".xpi 2>/dev/null | head -n 1 || true)"
  if [ -n "$xpi" ]; then
    echo "reusing local file: $xpi"
  else
    # Fallback 2: fetch the already-signed build straight from AMO.
    echo "no local copy - trying to fetch the signed $version build from AMO directly..."
    xpi="$(fetch_signed_xpi "$version" || true)"
    if [ -n "$xpi" ]; then
      echo "fetched from AMO: $xpi"
    else
      echo "could not fetch it from AMO (not finished signing yet, network issue, or credentials can't read it)."
      echo "error: could not obtain a signed $version build any way this script knows how." >&2
      echo >&2
      echo "Try one of:" >&2
      echo "  - Wait a couple of minutes (if the upload is still processing on AMO) and re-run ./sign-and-copy.sh." >&2
      echo "  - Check your AMO developer dashboard for a version $version build, and download it manually." >&2
      echo "  - Re-run with -b/--bump-version to bump the version and get a fresh signed build instead." >&2
      exit 1
    fi
  fi
fi

local_xpi="rhesus-share-$version.xpi"
cp "$xpi" "$local_xpi"
echo "copied to $script_dir/$local_xpi"

if command -v docker >/dev/null 2>&1 && docker inspect "$docker_container" >/dev/null 2>&1; then
  docker cp "$xpi" "$docker_container:$nginx_xpi_path"
else
  echo "warning: docker container '$docker_container' not found or docker not available - copy $xpi to the server manually" >&2
fi

cat <<EOF

Next steps on the Firefox for Android device:
  1. Download the .xpi from the homelab nginx URL (the /rhesus-share.xpi location, over Tailscale).
  2. Settings -> "Install Extension from File" -> browse to the downloaded file -> tap "Add".
EOF
