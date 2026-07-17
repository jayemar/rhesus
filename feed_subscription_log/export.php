<?php
// Downloads the full feed subscribe/unsubscribe log as CSV. Linked only from
// inside TT-RSS's own Preferences > Feeds tab, so it's reached from a
// browser tab that already has a TT-RSS session cookie - sessions.php below
// auto-starts that existing session (see its own NO_SESSION_AUTOSTART check),
// which is all the access control this needs: no new mechanism, just the
// same session the page it's linked from already required.
//
// Reachable at: GET /tt-rss/plugins.local/feed_subscription_log/export.php

$ttrss_root = dirname(__DIR__, 2);
chdir($ttrss_root);

require_once $ttrss_root . '/include/autoload.php';
require_once $ttrss_root . '/include/sessions.php';

$uid = $_SESSION['uid'] ?? null;
if ($uid === null) {
    http_response_code(403);
    header('Content-Type: text/plain');
    echo 'Not logged in.';
    exit;
}

$pdo = Db::pdo();
$sth = $pdo->prepare("
    SELECT created_at, action, feed_title, feed_url, category, note, reason
    FROM ttrss_plugin_feed_subscription_log
    WHERE owner_uid = ?
    ORDER BY created_at DESC
");
$sth->execute([$uid]);

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="feed_subscription_log.csv"');

$out = fopen('php://output', 'w');
fputcsv($out, ['Date', 'Action', 'Feed Title', 'Feed URL', 'Category', 'Note', 'Reason']);

while ($row = $sth->fetch()) {
    fputcsv($out, [
        $row['created_at'],
        $row['action'],
        $row['feed_title'],
        $row['feed_url'],
        $row['category'],
        $row['note'],
        $row['reason'],
    ]);
}

fclose($out);
