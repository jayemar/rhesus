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
The nginx config already contains the required location block in `frontend/nginx.conf`:

```nginx
location /rhesus-share.xpi {
    alias /usr/share/nginx/html/rhesus-share.xpi;
    types { application/x-xpinstall xpi; }
}
```

Copy the signed file into the running frontend container:

```
docker cp web-ext-artifacts/rhesus_share-<version>.xpi ttrss-frontend-1:/usr/share/nginx/html/rhesus-share.xpi
```

The copy takes effect immediately - no container restart needed. Note that the
file does not survive a container rebuild; re-run the `docker cp` command after
any `docker compose up --build frontend`.

## Step 4 - Install on Firefox for Android

Firefox for Android does not install extensions from arbitrary URLs. The
extension must be added to an AMO collection first.

**Create an AMO collection (one-time setup):**

1. Log in at https://addons.mozilla.org
2. Go to "My Collections" and create a new collection (e.g. "Homelab")
3. Add the extension to the collection - search by name or ID (`rhesus-share@homelab`)
4. Find your numeric AMO User ID in your account settings

**Configure Firefox for Android to use the collection:**

1. Open Firefox - go to Settings - About Firefox
2. Tap the Firefox logo 5 times to unlock developer options
3. Tap "Custom Add-on collection"
4. Enter your numeric AMO User ID and the collection name
5. Firefox restarts and loads the collection

The extension will now appear in the Add-ons section of Firefox settings.
Tap "Install", then tap the bookmark icon in the toolbar and "Open Settings"
to enter your TT-RSS URL and credentials.
