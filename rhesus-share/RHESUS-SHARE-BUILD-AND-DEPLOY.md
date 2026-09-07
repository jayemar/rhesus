# Building and Deploying Rhesus Share to Firefox for Android

Firefox for Android only installs extensions signed by Mozilla. These steps
cover getting the extension signed, hosting it, and installing it on device.
There is no unpacked/temporary-load option on Android, so any code change -
however small - requires repeating Steps 2-3 (re-sign/re-host, reinstall)
before it can be tested or used on device. Bump the `version` in
`manifest.json` on each rebuild so it's clear a new build is installed.

**AMO:** addons.mozilla.org

## Step 1 - Get AMO API credentials (one-time setup)

1. Create a Mozilla account at https://accounts.firefox.com if you don't have one.
2. Go to https://addons.mozilla.org/developers/addon/api/key/ and generate
   an API key. Mozilla calls these "JWT issuer" and "JWT secret".

## Step 2 - Sign and host the extension

Copy `.env.example` to `.env` in `rhesus-share/` and fill in `AMO_JWT_ISSUER`
and `AMO_JWT_SECRET` with the API key from Step 1 (one-time setup; `.env` is
gitignored).

The nginx config already contains the location block needed to serve the
`.xpi` over Tailscale, in `rhesus-server/nginx.conf` (one-time setup, already
in place):

```nginx
location /rhesus-share.xpi {
    alias /usr/share/nginx/html/rhesus-share.xpi;
    types { application/x-xpinstall xpi; }
}
```

From the `rhesus-share/` directory:

```
./sign-and-copy.sh
```

This reads the credentials from `.env`, runs `web-ext sign --channel=unlisted`,
then copies the resulting `.xpi` to `rhesus-share-<version>.xpi` in this
directory (e.g. `rhesus-share-1.2.0.xpi`) and into the running rhesus-server
container at `/usr/share/nginx/html/rhesus-share.xpi` (override the
container name or path via `DOCKER_CONTAINER`/`NGINX_XPI_PATH` in `.env` if
needed). `--channel=unlisted` means the extension is never listed publicly
on AMO but is still signed by Mozilla. web-ext names its own artifact under
`web-ext-artifacts/` after the extension's internal ID, not `manifest.json`'s
`version`, so `sign-and-copy.sh` locates it automatically rather than
assuming a fixed name - the versioned copy in this directory exists so you
don't have to hunt for it there.

The local copy and the container copy are independent: the local one just
sits on disk (gitignored) for you to find or re-copy manually, while the
container copy is what's actually served. That copy takes effect immediately
in the container - no restart needed - but does not survive a container
recreate; re-run `./sign-and-copy.sh` (or a manual `docker cp` of the local
versioned copy) after any `docker compose pull rhesus-server && docker
compose up -d rhesus-server` (which picks up a newly published image).

Re-run this step after any code change to produce and host an updated signed
file - bump `version` in `manifest.json` first (see note above). The
extension ID in `manifest.json` keeps the same AMO record across versions.

**If AMO reports a version conflict** (`Version X already exists` or `This
upload has already been submitted`, both mean AMO already has this version in
some state), `sign-and-copy.sh` tries, in order:

1. A matching `.xpi` already in `web-ext-artifacts/` from an earlier run.
2. Fetching the already-signed build directly from AMO's own signing-status
   API, using the same `AMO_JWT_ISSUER`/`AMO_JWT_SECRET` credentials (no
   dashboard visit needed) - this works once AMO has actually finished
   signing that version, even if this machine never downloaded the result.
3. **Only with `-b`/`--bump-version`:** bump the subminor (patch) version in
   `manifest.json` and retry once with a fresh version. This is an
   administrative bump only (no functional change), purely to give AMO a
   version number it hasn't seen before - it doesn't recover the stuck
   version, it abandons it in favor of a new one.

If all three are unavailable (e.g. the upload is still processing on AMO and
you don't want to bump), the script prints these same options and exits
non-zero rather than guessing.

## Step 3 - Install on Firefox for Android

AMO custom collections only work with publicly listed extensions. Since this
extension is unlisted, the collection approach does not apply. Use the
"Install from File" method instead.

**Enable "Install from File" in Firefox (one-time setup):**

1. Open Firefox - go to Settings - About Firefox
2. Tap the Firefox logo 5 times rapidly until you see "Debug menu enabled"
3. Go back to Settings - "Install Extension from File" now appears

**Transfer the `.xpi` to the device:**

Download it from the homelab nginx server in any browser or file manager on
the device (e.g. navigate to the Tailscale URL). Firefox will download the
file rather than install it - this is expected. You need the file on the
device in order to use "Install from File".

**Install:**

1. Settings - "Install Extension from File"
2. Browse to the downloaded `.xpi` and tap it
3. Tap "Add" when prompted

Tap the bookmark icon in the toolbar and "Open Settings" to enter your
TT-RSS URL and credentials.

**Updating:**

Automatic updates do not work for unlisted extensions. To install a new
version, sign and host the updated `.xpi` (Step 2), download it to the
device, and repeat the install steps above.
