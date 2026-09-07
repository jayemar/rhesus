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
./sign.sh
```

This reads the credentials from `.env`, runs `web-ext sign --channel=unlisted`,
then copies the resulting `.xpi` into the running rhesus-server container at
`/usr/share/nginx/html/rhesus-share.xpi` (override the container name or path
via `DOCKER_CONTAINER`/`NGINX_XPI_PATH` in `.env` if needed). `--channel=unlisted`
means the extension is never listed publicly on AMO but is still signed by
Mozilla. web-ext names the signed `.xpi` file after the extension's internal
ID, not `manifest.json`'s `version`, so `sign.sh` locates it automatically
rather than assuming a fixed name.

The copy takes effect immediately - no container restart needed. Note that the
file does not survive a container recreate; re-run `./sign.sh` (or a manual
`docker cp`) after any `docker compose pull rhesus-server && docker compose up
-d rhesus-server` (which picks up a newly published image).

Re-run this step after any code change to produce and host an updated signed
file - bump `version` in `manifest.json` first (see note above). The
extension ID in `manifest.json` keeps the same AMO record across versions.

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
