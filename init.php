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
        $host->add_api_method("importOpml", $this);
        $host->add_api_method("fetchFullContent", $this);
        $host->add_api_method("resolveSubscribeUrl", $this);
        $host->add_hook(PluginHost::HOOK_HEADLINES_CUSTOM_SORT_OVERRIDE, $this);
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
        $feed->save();
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
    public function resolveSubscribeUrl(): array {
        $url = trim($_REQUEST['url'] ?? '');
        if ($url === '') return [1, ["error" => "MISSING_URL"]];
        if (($_SESSION['uid'] ?? null) === null) return [1, ["error" => "NOT_LOGGED_IN"]];

        $parsed = parse_url($url);
        $scheme = strtolower($parsed['scheme'] ?? '');
        if ($scheme !== 'http' && $scheme !== 'https') {
            return [1, ["error" => "INVALID_URL"]];
        }
        $host = $parsed['host'] ?? '';
        $port = isset($parsed['port']) ? (int)$parsed['port'] : ($scheme === 'https' ? 443 : 80);
        if ($port !== 80 && $port !== 443) {
            return [1, ["error" => "INVALID_URL"]];
        }
        $ip = gethostbyname($host);
        if (filter_var($ip, FILTER_VALIDATE_IP) &&
            !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return [1, ["error" => "INVALID_URL"]];
        }

        $contents = UrlHelper::fetch(['url' => $url]);
        if (!$contents) return [0, ["url" => $url, "discovered" => false]];

        $ct = UrlHelper::$fetch_last_content_type ?? '';
        if (!str_contains($ct, 'html')) return [0, ["url" => $url, "discovered" => false]];

        $feedUrls = $this->extractFeedLinks($url, $contents);
        if (count($feedUrls) === 1) return [0, ["url" => $feedUrls[0], "discovered" => true]];

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
