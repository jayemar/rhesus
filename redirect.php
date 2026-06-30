<?php
// Establishes a cookie-based TT-RSS session from the Rhesus API session ID,
// then redirects to prefs.php as the correct user.

$ttrss_root = dirname(__DIR__, 2);
chdir($ttrss_root);

define('NO_SESSION_AUTOSTART', true);
require_once $ttrss_root . '/include/autoload.php';
require_once $ttrss_root . '/include/sessions.php';

$api_sid = trim($_GET['sid'] ?? '');
if (!$api_sid || !preg_match('/^[a-f0-9]{32}$/', $api_sid)) {
    http_response_code(400);
    exit('Invalid session');
}

// Load the API session (no cookies) to read its variables
ini_set('session.use_cookies', '0');
session_id($api_sid);
session_start();
$session_data = $_SESSION;
session_write_close();

if (empty($session_data['uid'])) {
    header('Location: /tt-rss/index.php');
    exit;
}

// Discard any existing session cookie so session_start() creates a
// brand-new session rather than resuming the browser's previous one
// (which may belong to a different user, e.g. from logging in on a
// different port).
unset($_COOKIE[session_name()]);
ini_set('session.use_cookies', '1');
session_start();
foreach ($session_data as $key => $value) {
    $_SESSION[$key] = $value;
}
session_write_close();

header('Location: /tt-rss/prefs.php');
exit;
