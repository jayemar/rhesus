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
            return [0, ["settings" => $this->default_settings()]];
        }

        $decoded = json_decode($stored, true);

        if (!is_array($decoded)) {
            return [0, ["settings" => $this->default_settings()]];
        }

        // Merge with defaults so new keys are always present
        $settings = array_merge($this->default_settings(), $decoded);

        return [0, ["settings" => $settings]];
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
