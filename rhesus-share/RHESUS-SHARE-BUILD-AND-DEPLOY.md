# Building and Deploying Rhesus Share to Firefox for Android

Firefox for Android only installs extensions signed by Mozilla. These steps
cover getting the extension signed, hosting it, and installing it on device.

**AMO:** addons.mozilla.org

## Step 1 - Get AMO API credentials (one-time setup)

1. Create a Mozilla account at https://accounts.firefox.com if you don't have one.
2. Go to https://addons.mozilla.org/developers/addon/api/key/ and generate
   an API key. Mozilla calls these "JWT issuer" and "JWT secret".

## Step 2 - Sign the extension

From the `rhesus-share/` directory:

```
npx web-ext sign --api-key=<JWT issuer> --api-secret=<JWT secret> --channel=unlisted
```

`--channel=unlisted` means the extension is never listed publicly on AMO but
is still signed by Mozilla. The signed `.xpi` is written to
`web-ext-artifacts/rhesus_share-<version>.xpi`.

Re-run this command after any code changes to produce an updated signed file.
The extension ID in `manifest.json` keeps the same AMO record across versions.

## Step 3 - Host the `.xpi`

Serve the signed file from the homelab nginx so it is reachable via Tailscale.
The nginx config already contains the required location block in `rhesus-server/nginx.conf`:

```nginx
location /rhesus-share.xpi {
    alias /usr/share/nginx/html/rhesus-share.xpi;
    types { application/x-xpinstall xpi; }
}
```

Copy the signed file into the running rhesus-server container:

```
docker cp web-ext-artifacts/rhesus_share-<version>.xpi ttrss-rhesus-server-1:/usr/share/nginx/html/rhesus-share.xpi
```

The copy takes effect immediately - no container restart needed. Note that the
file does not survive a container recreate; re-run the `docker cp` command
after any `docker compose pull rhesus-server && docker compose up -d
rhesus-server` (which picks up a newly published image).

## Step 4 - Install on Firefox for Android

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
version, sign and copy the updated `.xpi` (Steps 2-3), download it to the
device, and repeat the install steps above.
