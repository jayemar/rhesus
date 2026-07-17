<?php
// Publishes the feed subscribe/unsubscribe log as a plain RSS 2.0 feed.
//
// Deliberately unauthenticated: an RSS feed is meant to be plainly fetchable
// by a reader (including by subscribing to it from within TT-RSS itself),
// not access-controlled the way a JSON API call is. If this ever needs to be
// kept private, that's a job for network/reverse-proxy access control, not
// this script.
//
// Reachable at: GET /tt-rss/plugins.local/feed_subscription_log/feed.php

$ttrss_root = dirname(__DIR__, 2);
chdir($ttrss_root);

define('NO_SESSION_AUTOSTART', true);
require_once $ttrss_root . '/include/autoload.php';

$pdo = Db::pdo();
$sth = $pdo->query("
    SELECT id, action, feed_title, feed_url, category, note, reason, created_at
    FROM ttrss_plugin_feed_subscription_log
    ORDER BY created_at DESC
    LIMIT 200
");
$rows = $sth->fetchAll();

$self_url = Config::get_self_url() . '/plugins.local/feed_subscription_log/feed.php';

function xml_escape(?string $s): string {
    return htmlspecialchars($s ?? '', ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

header('Content-Type: application/rss+xml; charset=utf-8');

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<rss version="2.0">' . "\n";
echo '<channel>' . "\n";
echo '<title>' . xml_escape('Feed Subscription Log') . '</title>' . "\n";
echo '<link>' . xml_escape($self_url) . '</link>' . "\n";
echo '<description>' . xml_escape('Feed subscribe/unsubscribe history') . '</description>' . "\n";

foreach ($rows as $row) {
    $verb = $row['action'] === 'subscribed' ? 'Subscribed' : 'Unsubscribed';
    $title = $verb . ': ' . ($row['feed_title'] ?: $row['feed_url']);

    $description_parts = [];
    $description_parts[] = 'URL: ' . $row['feed_url'];
    if ($row['category']) $description_parts[] = 'Category: ' . $row['category'];
    if ($row['note']) $description_parts[] = 'Note: ' . $row['note'];
    if ($row['reason']) $description_parts[] = 'Reason: ' . $row['reason'];

    $pub_date = date(DATE_RSS, strtotime($row['created_at']));

    echo '<item>' . "\n";
    echo '<title>' . xml_escape($title) . '</title>' . "\n";
    echo '<description>' . xml_escape(implode(' - ', $description_parts)) . '</description>' . "\n";
    echo '<pubDate>' . xml_escape($pub_date) . '</pubDate>' . "\n";
    echo '<guid isPermaLink="false">feed-subscription-log-' . (int)$row['id'] . '</guid>' . "\n";
    echo '</item>' . "\n";
}

echo '</channel>' . "\n";
echo '</rss>' . "\n";
