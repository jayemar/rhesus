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
