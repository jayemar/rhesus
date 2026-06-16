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
            "font_size"               => 14,
            "font_family"             => "system",
            "date_sort"               => "retrieval",
            "load_on_startup"         => false,
            "poll_interval"           => 0,
        ];
    }
}
