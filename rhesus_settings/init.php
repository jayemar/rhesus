<?php
class Rhesus_Settings extends Plugin {

    private $host;

    public function about() {
        return [
            1.0,
            "Stores per-user UI settings for the Rhesus frontend",
            "jayemar",
            true,  // system plugin - required to register JSON API methods
        ];
    }

    public function init($host) {
        $this->host = $host;
        $host->add_api_method("getUiSettings", $this);
        $host->add_api_method("setUiSettings", $this);
        $host->add_api_method("createLabel", $this);
        $host->add_api_method("deleteLabel", $this);
        $host->add_api_method("getFilters", $this);
        $host->add_api_method("saveFilter", $this);
        $host->add_api_method("deleteFilter", $this);
        $host->add_api_method("setFilterEnabled", $this);
        $host->add_api_method("editFeed", $this);
        $host->add_api_method("getFeedNotes", $this);
        $host->add_api_method("removeFeedIcon", $this);
        $host->add_api_method("fetchIconFromUrl", $this);
        $host->add_api_method("importOpml", $this);
        $host->add_api_method("fetchFullContent", $this);
        $host->add_api_method("resolveSubscribeUrl", $this);
        $host->add_api_method("previewFeed", $this);
        $host->add_api_method("getStarredCount", $this);
        $host->add_api_method("getLabelCounts", $this);
        $host->add_api_method("getAllArticlesCount", $this);
        $host->add_hook(PluginHost::HOOK_HEADLINES_CUSTOM_SORT_OVERRIDE, $this);
        $host->add_hook(PluginHost::HOOK_FEED_FETCHED, $this);
        $host->add_hook(PluginHost::HOOK_RENDER_ARTICLE_API, $this);
    }

    // TT-RSS's JSON API never returns date_entered (the column headline
    // ordering actually sorts by, distinct from `updated`/the publish date) -
    // this adds it to every article/headline response so Rhesus can display
    // it when the user's "Sort articles by" setting is "Retrieval date".
    public function hook_render_article_api($row) {
        $article = $row['headline'] ?? $row['article'] ?? $row;

        if (isset($article['id'])) {
            $sth = $this->pdo->prepare("SELECT date_entered FROM ttrss_entries WHERE id = ?");
            $sth->execute([$article['id']]);
            $date_entered = $sth->fetchColumn();
            $article['date_entered'] = $date_entered ? (int)strtotime($date_entered) : null;
        }

        return $article;
    }

    // Fix common XML malformations in raw feed content before LibXML parsing.
    public function hook_feed_fetched($feed_data, $fetch_url, $owner_uid, $feed): string {
        // If the response is an HTML page (bot-protection challenge, error page, etc.)
        // return empty string so FeedParser stores 'Empty feed data provided' as last_error,
        // which Rhesus maps to a human-readable bot-protection message.
        $trimmed = ltrim($feed_data);
        if (stripos($trimmed, '<html') === 0 || stripos($trimmed, '<!doctype') === 0) {
            return '';
        }

        // Error 23: bare & not part of a valid entity reference (e.g. URLs with &param=value).
        $feed_data = preg_replace(
            '/&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#[0-9]+|#x[0-9a-fA-F]+);)/',
            '&amp;',
            $feed_data
        );

        // Error 76: HTML void elements with attributes that lack a self-closing slash
        // (e.g. <link rel="stylesheet"> or <meta charset="utf-8"> embedded in feed content).
        // Matching on \s ensures the tag has attributes, which distinguishes HTML <link rel=...>
        // from the RSS channel <link>https://...</link> (no attributes, won't match).
        // The [^\/] before > ensures already-self-closed tags are left alone.
        $voids = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
                  'link', 'meta', 'param', 'source', 'track', 'wbr'];
        foreach ($voids as $tag) {
            $feed_data = preg_replace(
                '/<' . $tag . '(\s[^>]*[^\/])>/i',
                '<' . $tag . '$1/>',
                $feed_data
            );
        }
        // Also self-close attribute-less <br> and <hr>.
        $feed_data = (string) preg_replace('/<(br|hr)>/i', '<$1/>', $feed_data);

        return $feed_data;
    }

    public function hook_headlines_custom_sort_override($order) {
        if ($order === 'last_marked_asc')   return ["last_marked, date_entered, updated", false];
        if ($order === 'date_entered_desc') return ["date_entered DESC", false];
        if ($order === 'date_entered_asc')  return ["date_entered",      true];
        return ["", false];
    }

    public function api_version() {
        return 2;
    }

    // Returns stored settings as a JSON object.
    // Called via: POST /tt-rss/api/ {"op":"getUiSettings","sid":"..."}
    public function getUiSettings(): array {
        $stored = $this->host->get($this, "settings", null);

        if ($stored === null) {
            $settings = $this->default_settings();
        } else {
            $decoded = json_decode($stored, true);
            $settings = is_array($decoded)
                ? array_merge($this->default_settings(), $decoded)
                : $this->default_settings();
        }

        $uid = $_SESSION['uid'] ?? null;
        $user_name = '';
        if ($uid !== null) {
            $sth = Db::pdo()->prepare("SELECT login FROM ttrss_users WHERE id = ?");
            $sth->execute([$uid]);
            $row = $sth->fetch();
            $user_name = $row ? (string)$row['login'] : '';
        }

        return [0, ["settings" => $settings, "user_name" => $user_name]];
    }

    // Accepts a settings object and persists it.
    // Called via: POST /tt-rss/api/ {"op":"setUiSettings","sid":"...","settings":{...}}
    public function setUiSettings(): array {
        $raw = $_REQUEST["settings"] ?? null;

        if ($raw === null) {
            return [1, ["error" => "MISSING_SETTINGS"]];
        }

        // Accept both a JSON string and an already-decoded object from PHP
        if (is_string($raw)) {
            $decoded = json_decode($raw, true);
        } else {
            $decoded = $raw;
        }

        if (!is_array($decoded)) {
            return [1, ["error" => "INVALID_SETTINGS"]];
        }

        // Only persist known keys to avoid storing arbitrary data
        $sanitized = array_intersect_key($decoded, $this->default_settings());

        $this->host->set($this, "settings", json_encode($sanitized));

        return [0, ["status" => "OK"]];
    }

    // Creates a label if it doesn't exist, returns its ID either way.
    // Called via: POST /tt-rss/api/ {"op":"createLabel","sid":"...","caption":"..."}
    public function createLabel(): array {
        $caption = trim($_REQUEST["caption"] ?? '');
        if ($caption === '') {
            return [1, ["error" => "MISSING_CAPTION"]];
        }
        $uid = $_SESSION['uid'] ?? null;
        if ($uid === null) {
            return [1, ["error" => "NOT_LOGGED_IN"]];
        }
        $existing_id = Labels::find_id($caption, $uid);
        if ($existing_id) {
            return [0, ["id" => $existing_id, "caption" => $caption, "created" => false]];
        }
        Labels::create($caption, '', '', $uid);
        $new_id = Labels::find_id($caption, $uid);
        return [0, ["id" => $new_id, "caption" => $caption, "created" => true]];
    }

    // Deletes a label and all its article associations.
    // Called via: POST /tt-rss/api/ {"op":"deleteLabel","sid":"...","label_id":N}
    public function deleteLabel(): array {
        $label_id = (int)($_REQUEST['label_id'] ?? 0);
        if (!$label_id) {
            return [1, ["error" => "MISSING_LABEL_ID"]];
        }
        $uid = $_SESSION['uid'] ?? null;
        if ($uid === null) {
            return [1, ["error" => "NOT_LOGGED_IN"]];
        }
        $pdo = Db::pdo();
        $sth = $pdo->prepare("SELECT id FROM ttrss_labels2 WHERE id = ? AND owner_uid = ?");
        $sth->execute([$label_id, $uid]);
        if (!$sth->fetch()) {
            return [1, ["error" => "LABEL_NOT_FOUND"]];
        }
        $pdo->prepare("DELETE FROM ttrss_user_labels2 WHERE label_id = ?")->execute([$label_id]);
        $pdo->prepare("DELETE FROM ttrss_labels2 WHERE id = ? AND owner_uid = ?")->execute([$label_id, $uid]);
        return [0, ["deleted" => true]];
    }

    // Returns all filters with their rules and actions for the current user.
    public function getFilters(): array {
        $uid = $_SESSION['uid'] ?? null;
        if ($uid === null) return [1, ["error" => "NOT_LOGGED_IN"]];
        $pdo = Db::pdo();

        $sth = $pdo->prepare("SELECT id, title, enabled, match_any_rule, inverse, last_triggered FROM ttrss_filters2 WHERE owner_uid = ? ORDER BY order_id, id");
        $sth->execute([$uid]);
        $filters = $sth->fetchAll(PDO::FETCH_ASSOC);

        $out = [];
        foreach ($filters as $f) {
            $rsth = $pdo->prepare("SELECT id, reg_exp, filter_type, inverse, feed_id, cat_id, cat_filter FROM ttrss_filters2_rules WHERE filter_id = ?");
            $rsth->execute([$f['id']]);
            $rules = $rsth->fetchAll(PDO::FETCH_ASSOC);

            $asth = $pdo->prepare("SELECT id, action_id, action_param FROM ttrss_filters2_actions WHERE filter_id = ?");
            $asth->execute([$f['id']]);
            $actions = $asth->fetchAll(PDO::FETCH_ASSOC);

            $out[] = [
                "id"            => (int)$f['id'],
                "title"         => (string)$f['title'],
                "enabled"       => (bool)$f['enabled'],
                "match_any_rule"=> (bool)$f['match_any_rule'],
                "inverse"       => (bool)$f['inverse'],
                "last_triggered"=> $f['last_triggered'],
                "rules"         => array_map(fn($r) => [
                    "id"          => (int)$r['id'],
                    "reg_exp"     => (string)$r['reg_exp'],
                    "filter_type" => (int)$r['filter_type'],
                    "inverse"     => (bool)$r['inverse'],
                    "feed_id"     => $r['feed_id'] !== null ? (int)$r['feed_id'] : null,
                    "cat_id"      => $r['cat_id'] !== null ? (int)$r['cat_id'] : null,
                    "cat_filter"  => (bool)$r['cat_filter'],
                ], $rules),
                "actions" => array_map(fn($a) => [
                    "id"           => (int)$a['id'],
                    "action_id"    => (int)$a['action_id'],
                    "action_param" => (string)$a['action_param'],
                ], $actions),
            ];
        }
        return [0, ["filters" => $out]];
    }

    // Creates or updates a filter with its rules and actions.
    // Called via: POST /tt-rss/api/ {"op":"saveFilter","sid":"...","title":"...","enabled":true,...,"rules":"[...]","actions":"[...]"}
    public function saveFilter(): array {
        $uid = $_SESSION['uid'] ?? null;
        if ($uid === null) return [1, ["error" => "NOT_LOGGED_IN"]];
        $pdo = Db::pdo();

        $id            = isset($_REQUEST['id']) && $_REQUEST['id'] !== '' ? (int)$_REQUEST['id'] : null;
        $title         = trim($_REQUEST['title'] ?? '');
        $enabled       = filter_var($_REQUEST['enabled'] ?? true, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
        $match_any     = filter_var($_REQUEST['match_any_rule'] ?? true, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
        $inverse       = filter_var($_REQUEST['inverse'] ?? false, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
        $rules_raw     = $_REQUEST['rules'] ?? '[]';
        $actions_raw   = $_REQUEST['actions'] ?? '[]';

        $rules   = json_decode($rules_raw, true);
        $actions = json_decode($actions_raw, true);
        if (!is_array($rules) || !is_array($actions)) return [1, ["error" => "INVALID_DATA"]];

        if ($id !== null) {
            $sth = $pdo->prepare("SELECT id FROM ttrss_filters2 WHERE id = ? AND owner_uid = ?");
            $sth->execute([$id, $uid]);
            if (!$sth->fetch()) return [1, ["error" => "FILTER_NOT_FOUND"]];
            $pdo->prepare("UPDATE ttrss_filters2 SET title=?, enabled=?, match_any_rule=?, inverse=? WHERE id=?")->execute([$title, $enabled, $match_any, $inverse, $id]);
            $pdo->prepare("DELETE FROM ttrss_filters2_rules WHERE filter_id=?")->execute([$id]);
            $pdo->prepare("DELETE FROM ttrss_filters2_actions WHERE filter_id=?")->execute([$id]);
        } else {
            $sth = $pdo->prepare("INSERT INTO ttrss_filters2 (owner_uid, title, enabled, match_any_rule, inverse) VALUES (?,?,?,?,?) RETURNING id");
            $sth->execute([$uid, $title, $enabled, $match_any, $inverse]);
            $id = (int)$sth->fetchColumn();
        }

        foreach ($rules as $r) {
            $pdo->prepare("INSERT INTO ttrss_filters2_rules (filter_id, reg_exp, filter_type, inverse, feed_id, cat_id, cat_filter) VALUES (?,?,?,?,?,?,?)")->execute([
                $id,
                (string)($r['reg_exp'] ?? ''),
                (int)($r['filter_type'] ?? 1),
                ($r['inverse'] ?? false) ? 'true' : 'false',
                isset($r['feed_id']) && $r['feed_id'] !== null && !($r['cat_filter'] ?? false) ? (int)$r['feed_id'] : null,
                isset($r['cat_id']) && $r['cat_id'] !== null && ($r['cat_filter'] ?? false) ? (int)$r['cat_id'] : null,
                ($r['cat_filter'] ?? false) ? 'true' : 'false',
            ]);
        }
        foreach ($actions as $a) {
            $pdo->prepare("INSERT INTO ttrss_filters2_actions (filter_id, action_id, action_param) VALUES (?,?,?)")->execute([
                $id,
                (int)($a['action_id'] ?? 2),
                (string)($a['action_param'] ?? ''),
            ]);
        }

        return [0, ["id" => $id]];
    }

    // Deletes a filter and its rules/actions (via cascade).
    public function deleteFilter(): array {
        $uid = $_SESSION['uid'] ?? null;
        if ($uid === null) return [1, ["error" => "NOT_LOGGED_IN"]];
        $id = (int)($_REQUEST['id'] ?? 0);
        if (!$id) return [1, ["error" => "MISSING_ID"]];
        $pdo = Db::pdo();
        $sth = $pdo->prepare("SELECT id FROM ttrss_filters2 WHERE id = ? AND owner_uid = ?");
        $sth->execute([$id, $uid]);
        if (!$sth->fetch()) return [1, ["error" => "FILTER_NOT_FOUND"]];
        $pdo->prepare("DELETE FROM ttrss_filters2 WHERE id = ? AND owner_uid = ?")->execute([$id, $uid]);
        return [0, ["deleted" => true]];
    }

    // Enables or disables a filter.
    public function setFilterEnabled(): array {
        $uid = $_SESSION['uid'] ?? null;
        if ($uid === null) return [1, ["error" => "NOT_LOGGED_IN"]];
        $id      = (int)($_REQUEST['id'] ?? 0);
        $enabled = filter_var($_REQUEST['enabled'] ?? true, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
        if (!$id) return [1, ["error" => "MISSING_ID"]];
        $pdo = Db::pdo();
        $sth = $pdo->prepare("SELECT id FROM ttrss_filters2 WHERE id = ? AND owner_uid = ?");
        $sth->execute([$id, $uid]);
        if (!$sth->fetch()) return [1, ["error" => "FILTER_NOT_FOUND"]];
        $pdo->prepare("UPDATE ttrss_filters2 SET enabled = ? WHERE id = ?")->execute([$enabled, $id]);
        return [0, ["ok" => true]];
    }

    // Updates a feed's title and/or category.
    // Called via: POST /tt-rss/api/ {"op":"editFeed","sid":"...","feed_id":N,"title":"...","cat_id":N}
    public function editFeed(): array {
        $feed_id = (int)($_REQUEST['feed_id'] ?? 0);
        if (!$feed_id) {
            return [1, ["error" => "MISSING_FEED_ID"]];
        }
        $uid = $_SESSION['uid'] ?? null;
        if ($uid === null) {
            return [1, ["error" => "NOT_LOGGED_IN"]];
        }
        $feed = ORM::for_table('ttrss_feeds')
            ->where(['id' => $feed_id, 'owner_uid' => $uid])
            ->find_one();
        if (!$feed) {
            return [1, ["error" => "FEED_NOT_FOUND"]];
        }
        if (isset($_REQUEST['title'])) {
            $title = trim($_REQUEST['title']);
            if ($title !== '') {
                $feed->title = $title;
            }
        }
        if (isset($_REQUEST['feed_url'])) {
            $feed_url = trim($_REQUEST['feed_url']);
            if ($feed_url !== '') {
                $feed->feed_url = $feed_url;
            }
        }
        if (isset($_REQUEST['cat_id'])) {
            $cat_id = (int)$_REQUEST['cat_id'];
            $feed->cat_id = $cat_id > 0 ? $cat_id : null;
        }
        if (isset($_REQUEST['update_interval'])) {
            $feed->update_interval = (int)$_REQUEST['update_interval'];
        }
        if (isset($_REQUEST['note'])) {
            $notes = $this->get_feed_notes_map();
            $note = trim($_REQUEST['note']);
            if ($note === '') {
                unset($notes[$feed_id]);
            } else {
                $notes[$feed_id] = $note;
            }
            $this->host->set($this, "feed_notes", json_encode($notes));
        }
        $feed->save();
        return [0, ["status" => "OK"]];
    }

    // Returns the current user's {feed_id: note} map, decoded from plugin storage.
    private function get_feed_notes_map(): array {
        $raw = $this->host->get($this, "feed_notes", null);
        $decoded = $raw !== null ? json_decode($raw, true) : null;
        return is_array($decoded) ? $decoded : [];
    }

    // Returns all of the current user's feed notes as {feed_id: note}.
    // Called via: POST /tt-rss/api/ {"op":"getFeedNotes","sid":"..."}
    public function getFeedNotes(): array {
        $uid = $_SESSION['uid'] ?? null;
        if ($uid === null) {
            return [1, ["error" => "NOT_LOGGED_IN"]];
        }
        return [0, ["notes" => $this->get_feed_notes_map()]];
    }

    // Total starred article count (read + unread). Native TT-RSS's
    // getFeedTree/getUnread always call Feeds::_get_counters() with
    // unread_only hardcoded to true, so there's no way to get a total
    // through the public API for the Starred virtual feed - this mirrors
    // what that function does internally for FEED_STARRED, just without
    // the unread_only filter.
    public function getStarredCount(): array {
        $uid = $_SESSION['uid'] ?? null;
        if ($uid === null) {
            return [1, ["error" => "NOT_LOGGED_IN"]];
        }
        $sth = Db::pdo()->prepare("SELECT COUNT(*) AS count FROM ttrss_user_entries WHERE owner_uid = ? AND marked = true");
        $sth->execute([$uid]);
        $row = $sth->fetch();
        return [0, ["count" => (int)($row['count'] ?? 0)]];
    }

    // Total (read + unread) article count across every feed for the current
    // user - i.e. what "All articles" (feed_id -4) actually contains. Mirrors
    // getStarredCount(): native TT-RSS's getFeedTree/getCounters only ever
    // report unread-only counts, even for -4, which has no feed_id
    // restriction of its own (TT-RSS's Feeds::_get_headlines() sets its
    // match condition to unconditional "true" for -4), so this is simply
    // every row for this user with no additional filter.
    public function getAllArticlesCount(): array {
        $uid = $_SESSION['uid'] ?? null;
        if ($uid === null) {
            return [1, ["error" => "NOT_LOGGED_IN"]];
        }
        $sth = Db::pdo()->prepare("SELECT COUNT(*) AS count FROM ttrss_user_entries WHERE owner_uid = ?");
        $sth->execute([$uid]);
        $row = $sth->fetch();
        return [0, ["count" => (int)($row['count'] ?? 0)]];
    }

    // Total (read + unread) article count per label for the current user,
    // keyed by label DB id. Mirrors getStarredCount(): native TT-RSS's
    // getFeedTree/getCounters only ever report unread-only counts for
    // labels (like every other feed), so this fills the same gap.
    public function getLabelCounts(): array {
        $uid = $_SESSION['uid'] ?? null;
        if ($uid === null) {
            return [1, ["error" => "NOT_LOGGED_IN"]];
        }
        $sth = Db::pdo()->prepare(
            "SELECT l.id AS label_id, COUNT(ul.article_id) AS count
             FROM ttrss_labels2 l
             LEFT JOIN ttrss_user_labels2 ul ON ul.label_id = l.id
             WHERE l.owner_uid = ?
             GROUP BY l.id"
        );
        $sth->execute([$uid]);
        $counts = [];
        foreach ($sth->fetchAll() as $row) {
            $counts[(int)$row['label_id']] = (int)$row['count'];
        }
        return [0, ["counts" => $counts]];
    }

    // Removes a feed's custom icon, restoring core's normal auto-detected
    // favicon behavior. Mirrors Pref_Feeds::removeIcon().
    // Called via: POST /tt-rss/api/ {"op":"removeFeedIcon","sid":"...","feed_id":N}
    public function removeFeedIcon(): array {
        $feed_id = (int)($_REQUEST['feed_id'] ?? 0);
        if (!$feed_id) {
            return [1, ["error" => "MISSING_FEED_ID"]];
        }
        $uid = $_SESSION['uid'] ?? null;
        if ($uid === null) {
            return [1, ["error" => "NOT_LOGGED_IN"]];
        }
        $feed = ORM::for_table('ttrss_feeds')
            ->where(['id' => $feed_id, 'owner_uid' => $uid])
            ->find_one();
        if (!$feed) {
            return [1, ["error" => "FEED_NOT_FOUND"]];
        }

        $cache = DiskCache::instance('feed-icons');
        if ($cache->exists((string)$feed_id)) {
            $cache->remove((string)$feed_id);
        }

        $feed->set([
            'favicon_avg_color' => null,
            'favicon_last_checked' => '1970-01-01',
            'favicon_is_custom' => false,
        ]);
        $feed->save();

        return [0, ["status" => "OK"]];
    }

    // Validates icon bytes (size, then real sniffed MIME type rather than a
    // trusted header/extension) and, if valid, stores them as $feed's custom
    // icon. Shared by fetchIconFromUrl() below and upload_icon.php, which is
    // a standalone script (not a Plugin API method, since it needs
    // multipart/form-data for its file upload) that requires this file
    // directly to reach this method - so both paths produce an identical
    // result from one place rather than two hand-maintained copies. Static
    // since it needs no plugin/host state, only $feed and the bytes.
    // Returns ["error" => null] on success, or ["error" => CODE, ...extra]
    // on failure (extra fields like max_size/detected_type for the caller
    // to pass straight through to the client).
    public static function saveFeedIcon($feed, string $content): array {
        $max_size = (int)Config::get(Config::MAX_FAVICON_FILE_SIZE);
        if (strlen($content) > $max_size) {
            return ["error" => "ICON_FILE_TOO_LARGE", "max_size" => $max_size];
        }

        // Sniff the real content rather than trusting a Content-Type header
        // or the browser-reported upload type (either can lie, or be
        // absent) - this is what stops an SVG (which can carry embedded
        // <script>) from being accepted just because its header claims to
        // be a PNG, or because a browser upload dialog only checks that the
        // type starts with "image/", which image/svg+xml also satisfies.
        $tmp = tempnam(sys_get_temp_dir(), 'rhesus_icon_');
        if ($tmp === false || file_put_contents($tmp, $content) === false) {
            return ["error" => "ICON_READ_FAILED"];
        }
        $mime_type = mime_content_type($tmp);
        unlink($tmp);

        $allowed_mime_types = [
            'image/png', 'image/jpeg', 'image/gif', 'image/webp',
            'image/bmp', 'image/x-icon', 'image/vnd.microsoft.icon',
        ];
        if (!in_array($mime_type, $allowed_mime_types, true)) {
            return ["error" => "ICON_INVALID_TYPE", "detected_type" => $mime_type];
        }

        $cache = DiskCache::instance('feed-icons');
        if (!$cache->put((string)$feed->id, $content)) {
            return ["error" => "ICON_SAVE_FAILED"];
        }

        $feed->set([
            'favicon_avg_color' => null,
            'favicon_is_custom' => true,
        ]);
        $feed->save();

        return ["error" => null];
    }

    // Fetches an image from a URL server-side and sets it as a feed's icon -
    // an alternative to upload_icon.php's file upload, for when you just
    // have a link to an icon rather than a local file. The fetch itself
    // reuses the same SSRF-guarded fetch as previewFeed()/resolveSubscribeUrl()
    // - this endpoint fetches an arbitrary user-supplied URL server-side too,
    // so it needs the same protection.
    // Called via: POST /tt-rss/api/ {"op":"fetchIconFromUrl","sid":"...","feed_id":N,"url":"..."}
    public function fetchIconFromUrl(): array {
        $feed_id = (int)($_REQUEST['feed_id'] ?? 0);
        if (!$feed_id) {
            return [1, ["error" => "MISSING_FEED_ID"]];
        }
        $uid = $_SESSION['uid'] ?? null;
        if ($uid === null) {
            return [1, ["error" => "NOT_LOGGED_IN"]];
        }
        $feed = ORM::for_table('ttrss_feeds')
            ->where(['id' => $feed_id, 'owner_uid' => $uid])
            ->find_one();
        if (!$feed) {
            return [1, ["error" => "FEED_NOT_FOUND"]];
        }

        $url = trim($_REQUEST['url'] ?? '');
        if ($url === '') {
            return [1, ["error" => "MISSING_URL"]];
        }
        if ($err = $this->validateFetchUrl($url)) {
            return [1, ["error" => $err]];
        }

        $content = UrlHelper::fetch(['url' => $url]);
        if (!$content) {
            return [1, ["error" => "FETCH_FAILED", "message" => truncate_string(clean(UrlHelper::$fetch_last_error), 250, '…')]];
        }

        $result = self::saveFeedIcon($feed, $content);
        if ($result['error']) {
            return [1, $result];
        }

        return [0, ["status" => "OK"]];
    }

    // Imports an OPML file supplied as a string.
    // Called via: POST /tt-rss/api/ {"op":"importOpml","sid":"...","content":"<?xml ..."}
    public function importOpml(): array {
        $uid = $_SESSION['uid'] ?? null;
        if ($uid === null) {
            return [1, ["error" => "NOT_LOGGED_IN"]];
        }
        $content = $_REQUEST['content'] ?? '';
        if ($content === '') {
            return [1, ["error" => "MISSING_CONTENT"]];
        }
        $tmp = tempnam(sys_get_temp_dir(), 'rhesus_opml_');
        if ($tmp === false || file_put_contents($tmp, $content) === false) {
            return [1, ["error" => "TEMP_FILE_ERROR"]];
        }
        $opml = new OPML($_REQUEST);
        ob_start();
        $result = $opml->opml_import($uid, $tmp);
        ob_end_clean();
        unlink($tmp);
        if ($result) {
            return [0, ["status" => "OK"]];
        }
        return [1, ["error" => "IMPORT_FAILED"]];
    }

    // Fetches the full HTML of an article's source URL and returns the body content.
    // Called via: POST /tt-rss/api/ {"op":"fetchFullContent","sid":"...","article_id":N}
    public function fetchFullContent(): array {
        $article_id = (int)($_REQUEST['article_id'] ?? 0);
        if (!$article_id) {
            return [1, ["error" => "MISSING_ARTICLE_ID"]];
        }
        $uid = $_SESSION['uid'] ?? null;
        if ($uid === null) {
            return [1, ["error" => "NOT_LOGGED_IN"]];
        }

        $sth = Db::pdo()->prepare(
            "SELECT ttrss_entries.link
             FROM ttrss_entries
             JOIN ttrss_user_entries ON ttrss_entries.id = ttrss_user_entries.ref_id
             WHERE ttrss_user_entries.ref_id = ? AND ttrss_user_entries.owner_uid = ?
             LIMIT 1"
        );
        $sth->execute([$article_id, $uid]);
        $row = $sth->fetch();

        if (!$row || empty($row['link'])) {
            return [1, ["error" => "ARTICLE_NOT_FOUND"]];
        }

        $url = $row['link'];
        $html = UrlHelper::fetch(['url' => $url]);

        if (!$html) {
            return [1, ["error" => "FETCH_FAILED"]];
        }

        return [0, ["content" => $html, "url" => $url]];
    }

    // Fetches url and, if HTML with exactly one autodiscovery feed link, returns
    // the discovered feed URL. Otherwise returns the original URL unchanged.
    // Works around a TT-RSS bug where subscribeToFeed returns code 6 because it
    // fails to re-fetch content after extracting the autodiscovered feed URL.
    // Blocks anything other than plain http(s) on standard ports, and any
    // hostname resolving to a private/reserved IP (SSRF protection) -
    // resolveSubscribeUrl(), previewFeed(), and fetchIconFromUrl() all fetch
    // a user-supplied URL server-side, so all three need this.
    private function validateFetchUrl(string $url): ?string {
        $parsed = parse_url($url);
        $scheme = strtolower($parsed['scheme'] ?? '');
        if ($scheme !== 'http' && $scheme !== 'https') {
            return "INVALID_URL";
        }
        $host = $parsed['host'] ?? '';
        $port = isset($parsed['port']) ? (int)$parsed['port'] : ($scheme === 'https' ? 443 : 80);
        if ($port !== 80 && $port !== 443) {
            return "INVALID_URL";
        }
        $ip = gethostbyname($host);
        if (filter_var($ip, FILTER_VALIDATE_IP) &&
            !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return "INVALID_URL";
        }
        return null;
    }

    public function previewFeed(): array {
        $url = trim($_REQUEST['url'] ?? '');
        if ($url === '') return [1, ["error" => "MISSING_URL"]];
        if (($_SESSION['uid'] ?? null) === null) return [1, ["error" => "NOT_LOGGED_IN"]];

        if ($err = $this->validateFetchUrl($url)) return [1, ["error" => $err]];

        $contents = UrlHelper::fetch(['url' => $url]);
        if (empty($contents)) {
            return [1, ["error" => "FETCH_FAILED", "message" => truncate_string(clean(UrlHelper::$fetch_last_error), 250, '…')]];
        }

        $fp = new FeedParser($contents);
        // get_type() alone (as native subscribe uses) only validates the feed
        // is recognizable - it doesn't populate items/title/link. init() is
        // what actually parses the document into FeedItem objects.
        if (!$fp->init()) {
            $msg = $fp->error() ?: $contents;
            return [1, ["error" => "PARSE_FAILED", "message" => truncate_string(clean($msg), 250, '…')]];
        }

        $items = [];
        foreach (array_slice($fp->get_items(), 0, 20) as $item) {
            $items[] = [
                "title" => $item->get_title(),
                "link" => $item->get_link(),
                "date" => $item->get_date() ?: null,
                "description" => truncate_string(strip_tags($item->get_description()), 200),
            ];
        }

        return [0, [
            "title" => $fp->get_title(),
            "link" => $fp->get_link(),
            "items" => $items,
        ]];
    }

    public function resolveSubscribeUrl(): array {
        $url = trim($_REQUEST['url'] ?? '');
        if ($url === '') return [1, ["error" => "MISSING_URL"]];
        if (($_SESSION['uid'] ?? null) === null) return [1, ["error" => "NOT_LOGGED_IN"]];

        if ($err = $this->validateFetchUrl($url)) return [1, ["error" => $err]];

        $contents = UrlHelper::fetch(['url' => $url]);

        if ($contents) {
            $ct = UrlHelper::$fetch_last_content_type ?? '';
            if (str_contains($ct, 'html')) {
                $feedUrls = $this->extractFeedLinks($url, $contents);
                if (count($feedUrls) === 1) return [0, ["url" => $feedUrls[0], "discovered" => true]];
                if (count($feedUrls) > 1) {
                    // Multiple feeds found: prefer the one matching the root /feed/ path,
                    // otherwise take the first. This avoids a second request to TT-RSS
                    // that would re-trigger autodiscovery (and potentially hit WAF rate limits).
                    $parsed_origin = parse_url($url);
                    $root_feed = $parsed_origin['scheme'] . '://' . $parsed_origin['host'] . '/feed/';
                    $best = in_array($root_feed, $feedUrls) ? $root_feed : $feedUrls[0];
                    return [0, ["url" => $best, "discovered" => true]];
                }
            } elseif (str_contains($ct, 'rss') || str_contains($ct, 'atom') || str_contains($ct, 'xml')) {
                return [0, ["url" => $url, "discovered" => false]];
            }
        }

        // Homepage fetch failed or had no discoverable feed links.
        // Try common feed path patterns before giving up.
        $parsed_base = parse_url($url);
        $origin = $parsed_base['scheme'] . '://' . $parsed_base['host'];
        $candidates = [
            $origin . '/feed/',
            $origin . '/rss/',
            $origin . '/atom.xml',
            $origin . '/feed.xml',
            $origin . '/rss.xml',
        ];
        foreach ($candidates as $candidate) {
            $probe = UrlHelper::fetch(['url' => $candidate]);
            if ($probe) {
                $ct = UrlHelper::$fetch_last_content_type ?? '';
                if (str_contains($ct, 'rss') || str_contains($ct, 'atom') || str_contains($ct, 'xml')) {
                    return [0, ["url" => $candidate, "discovered" => true]];
                }
            }
        }

        return [0, ["url" => $url, "discovered" => false]];
    }

    private function extractFeedLinks(string $baseUrl, string $html): array {
        $dom = new DOMDocument();
        @$dom->loadHTML($html);
        $xpath = new DOMXPath($dom);
        $links = $xpath->query('//link[@rel="alternate"]');
        $feedUrls = [];
        foreach ($links as $link) {
            $type = $link->getAttribute('type');
            $href = $link->getAttribute('href');
            if (!$href || (!str_contains($type, 'rss') && !str_contains($type, 'atom'))) continue;
            if (!str_starts_with($href, 'http')) {
                $parsed = parse_url($baseUrl);
                $href = str_starts_with($href, '/')
                    ? $parsed['scheme'] . '://' . $parsed['host'] . $href
                    : rtrim($baseUrl, '/') . '/' . $href;
            }
            $feedUrls[] = $href;
        }
        return $feedUrls;
    }

    private function default_settings(): array {
        return [
            "theme"                   => "dark",
            "sort_order"              => "newest",
            "sidebar_collapsed"       => false,
            "show_thumbnails"         => true,
            "show_excerpt"            => true,
            "excerpt_lines"           => 2,
            "mark_on_scroll"          => true,
            "swipe_right_action"      => "none",
            "swipe_left_action"       => "none",
            "long_press_title"        => "copy_markdown",
            "font_size"               => 14,
            "font_family"             => "system",
            "date_sort"               => "retrieval",
            "load_on_startup"         => false,
            "poll_interval"           => 0,
        ];
    }
}
