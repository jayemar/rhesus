<?php
// Uploads a new icon for a feed the current user owns, from Rhesus's Feed
// Editor. Mirrors what TT-RSS core's Pref_Feeds::uploadIcon() does to
// ttrss_feeds and the feed-icons DiskCache (so serving/has_icon work
// unchanged for every client), but adds real content-type validation before
// accepting the file, which the native upload dialog lacks - it only checks
// the browser-reported MIME type starts with "image/", which image/svg+xml
// also satisfies, so an SVG "succeeds" there and only fails later at serve
// time with a 400 from DiskCache's own svg+xml blacklist (embedded-script
// risk). Validating the actual sniffed type here means an immediate, clear
// rejection instead of a silently-broken icon.
//
// This is a standalone script (not a Plugin API method) because it needs
// multipart/form-data for the file upload, and TT-RSS's sid-token JSON API
// (used for everything else this plugin exposes) only accepts JSON bodies.
// The alternative, backend.php's PluginHandler route, does support multipart
// but requires a real cookie-based PHP session, which Rhesus's SPA never
// establishes (it authenticates purely via the sid token). So instead this
// bootstraps a session directly from that sid, the same way
// redirect.php does for the "open native prefs" bridge.
//
// Called via: multipart POST /tt-rss/plugins.local/rhesus_settings/upload_icon.php
// with fields sid=..., feed_id=N, and a file field icon_file.

$ttrss_root = dirname(__DIR__, 2);
chdir($ttrss_root);

define('NO_SESSION_AUTOSTART', true);
require_once $ttrss_root . '/include/autoload.php';
require_once $ttrss_root . '/include/sessions.php';
// Rhesus_Settings::saveFeedIcon() isn't autoloaded - plugin classes are only
// loaded by PluginHost scanning plugins.local/, which this standalone script
// bypasses entirely (see the file-level comment above).
require_once __DIR__ . '/init.php';

// Response shape mirrors this plugin's other JSON API methods: {"status": 0|1, "content": {...}}
function fail(string $error, array $extra = []): never {
    header('Content-Type: application/json');
    echo json_encode(["status" => 1, "content" => array_merge(["error" => $error], $extra)]);
    exit;
}

function ok(array $content): never {
    header('Content-Type: application/json');
    echo json_encode(["status" => 0, "content" => $content]);
    exit;
}

$api_sid = trim($_POST['sid'] ?? '');
if (!$api_sid || !preg_match('/^[a-f0-9]{32}$/', $api_sid)) {
    fail('NOT_LOGGED_IN');
}

// Load the API session (no cookies) to read its variables, same pattern as
// redirect.php - this session is keyed by the sid Rhesus already holds.
ini_set('session.use_cookies', '0');
session_id($api_sid);
session_start();
$uid = $_SESSION['uid'] ?? null;
session_write_close();

if ($uid === null) {
    fail('NOT_LOGGED_IN');
}

$feed_id = (int)($_POST['feed_id'] ?? 0);
if (!$feed_id) {
    fail('MISSING_FEED_ID');
}

$feed = ORM::for_table('ttrss_feeds')
    ->where(['id' => $feed_id, 'owner_uid' => $uid])
    ->find_one();
if (!$feed) {
    fail('FEED_NOT_FOUND');
}

$upload = $_FILES['icon_file'] ?? null;
if (!$upload || !is_uploaded_file($upload['tmp_name'] ?? '')) {
    fail('MISSING_ICON_FILE');
}

$max_size = (int)Config::get(Config::MAX_FAVICON_FILE_SIZE);
if ($upload['size'] > $max_size) {
    fail('ICON_FILE_TOO_LARGE', ['max_size' => $max_size]);
}

$content = file_get_contents($upload['tmp_name']);
if ($content === false) {
    fail('ICON_READ_FAILED');
}

// Shared with fetchIconFromUrl() - same MIME sniffing (not the
// browser-reported type, which the native dialog only checks starts with
// "image/", which svg+xml also satisfies), same size limit, same
// DiskCache/feed-row updates.
$result = Rhesus_Settings::saveFeedIcon($feed, $content);
if ($result['error']) {
    fail($result['error'], array_diff_key($result, ['error' => true]));
}

ok(['status' => 'OK']);
