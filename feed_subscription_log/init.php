<?php
class Feed_Subscription_Log extends Plugin {
    private $host;

    public function about() {
        return [
            1.0,
            "Logs feed subscribe/unsubscribe events, viewable/exportable from Preferences > Feeds, and published as an RSS feed",
            "jayemar",
            true, // system plugin - required to register JSON API methods
        ];
    }

    public function api_version() {
        return 2;
    }

    private function ensure_schema() {
        try {
            $this->pdo->exec("
                CREATE TABLE IF NOT EXISTS ttrss_plugin_feed_subscription_log (
                    id SERIAL PRIMARY KEY,
                    owner_uid INTEGER NOT NULL,
                    action VARCHAR(20) NOT NULL,
                    feed_title VARCHAR(255),
                    feed_url VARCHAR(1024) NOT NULL,
                    category VARCHAR(255),
                    note TEXT,
                    reason TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (owner_uid) REFERENCES ttrss_users(id) ON DELETE CASCADE
                )
            ");
            $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_feed_subscription_log_owner_uid ON ttrss_plugin_feed_subscription_log(owner_uid)");
            $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_feed_subscription_log_created_at ON ttrss_plugin_feed_subscription_log(created_at)");

            $this->pdo->exec("
                CREATE TABLE IF NOT EXISTS ttrss_plugin_feed_subscription_log_pending (
                    feed_id INTEGER PRIMARY KEY,
                    owner_uid INTEGER NOT NULL,
                    reason TEXT,
                    note TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ");

            Debug::log("Feed subscription log plugin: Database schema initialized successfully");
        } catch (PDOException $e) {
            Debug::log("Feed subscription log plugin: Warning - could not ensure schema: " . $e->getMessage());
        }
    }

    public function init($host) {
        $this->host = $host;
        $this->ensure_schema();

        $host->add_hook($host::HOOK_UNSUBSCRIBE_FEED, $this);
        $host->add_hook($host::HOOK_PREFS_TAB, $this);
        $host->add_api_method("logFeedSubscribed", $this);
        $host->add_api_method("logUnsubscribeReason", $this);
    }

    // Fires before the ttrss_feeds row is deleted (native web UI and JSON API
    // both funnel through Pref_Feeds::remove_feed()) - look up the feed's
    // details while the row still exists, and pick up any reason/note the
    // frontend stashed via logUnsubscribeReason() just before this ran.
    function hook_unsubscribe_feed($feed_id, $owner_uid) {
        $feed = ORM::for_table('ttrss_feeds')->find_one($feed_id);

        if ($feed) {
            $pending = ORM::for_table('ttrss_plugin_feed_subscription_log_pending')->find_one($feed_id);

            $this->insert_log_row(
                $owner_uid,
                'unsubscribed',
                $feed->title,
                $feed->feed_url,
                $this->category_title($feed->cat_id),
                $pending ? $pending->note : null,
                $pending ? $pending->reason : null
            );

            if ($pending) $pending->delete();
        }

        return false; // never veto the actual unsubscribe
    }

    // Called by the Rhesus frontend right after a successful subscribeToFeed
    // - HOOK_SUBSCRIBE_FEED fires before the feed row/title exist, so this is
    // a frontend-initiated call instead of a hook (see plan notes). $note is
    // whatever was already entered in the existing Add Feed note field - no
    // separate "reason for subscribing" concept.
    function logFeedSubscribed() {
        $uid = $_SESSION['uid'] ?? null;
        if ($uid === null) return [1, ["error" => "NOT_LOGGED_IN"]];

        $feed_id = (int)($_REQUEST['feed_id'] ?? 0);
        if (!$feed_id) return [1, ["error" => "MISSING_FEED_ID"]];

        $note = trim($_REQUEST['note'] ?? '');

        $feed = ORM::for_table('ttrss_feeds')
            ->where(['id' => $feed_id, 'owner_uid' => $uid])
            ->find_one();

        if (!$feed) return [1, ["error" => "FEED_NOT_FOUND"]];

        $this->insert_log_row(
            $uid,
            'subscribed',
            $feed->title,
            $feed->feed_url,
            $this->category_title($feed->cat_id),
            $note !== '' ? $note : null,
            null
        );

        return [0, ["status" => "OK"]];
    }

    // Called by the Rhesus frontend right before it calls unsubscribeFeed, so
    // the reason/note is available when hook_unsubscribe_feed() fires
    // synchronously during that same request.
    function logUnsubscribeReason() {
        $uid = $_SESSION['uid'] ?? null;
        if ($uid === null) return [1, ["error" => "NOT_LOGGED_IN"]];

        $feed_id = (int)($_REQUEST['feed_id'] ?? 0);
        if (!$feed_id) return [1, ["error" => "MISSING_FEED_ID"]];

        $reason = trim($_REQUEST['reason'] ?? '');
        $note = trim($_REQUEST['note'] ?? '');

        $pdo = Db::pdo();
        $pdo->prepare("DELETE FROM ttrss_plugin_feed_subscription_log_pending WHERE feed_id = ?")
            ->execute([$feed_id]);
        $pdo->prepare("
            INSERT INTO ttrss_plugin_feed_subscription_log_pending (feed_id, owner_uid, reason, note)
            VALUES (?, ?, ?, ?)
        ")->execute([$feed_id, $uid, $reason !== '' ? $reason : null, $note !== '' ? $note : null]);

        return [0, ["status" => "OK"]];
    }

    function hook_prefs_tab($args) {
        if ($args != "prefFeeds") return;

        $uid = $_SESSION['uid'] ?? null;
        if ($uid === null) return;

        $base_url = Config::get_self_url();

        $sth = $this->pdo->prepare("
            SELECT action, feed_title, feed_url, category, note, reason, created_at
            FROM ttrss_plugin_feed_subscription_log
            WHERE owner_uid = ?
            ORDER BY created_at DESC
            LIMIT 100
        ");
        $sth->execute([$uid]);
        $rows = $sth->fetchAll();

        print "<div dojoType='dijit.layout.AccordionPane' title=\"<i class='material-icons'>history</i> " . __('Feed Subscription Log') . "\">";
        print "<h2>" . __('Feed Subscription Log') . "</h2>";

        print "<p>";
        print "<a target='_blank' href='" . htmlspecialchars($base_url . "/plugins.local/feed_subscription_log/feed.php") . "'>" . __('RSS feed of this log') . "</a>";
        print " &middot; ";
        print "<a target='_blank' href='" . htmlspecialchars($base_url . "/plugins.local/feed_subscription_log/export.php") . "'>" . __('Export full history as CSV') . "</a>";
        print "</p>";

        if (!$rows) {
            print "<p>" . __('No subscribe/unsubscribe events recorded yet.') . "</p>";
        } else {
            print "<table width='100%' cellspacing='0' cellpadding='4'>";
            print "<tr><th align='left'>" . __('Date') . "</th><th align='left'>" . __('Action') . "</th>";
            print "<th align='left'>" . __('Feed') . "</th><th align='left'>" . __('URL') . "</th>";
            print "<th align='left'>" . __('Category') . "</th>";
            print "<th align='left'>" . __('Note') . "</th><th align='left'>" . __('Reason') . "</th></tr>";

            foreach ($rows as $row) {
                print "<tr>";
                print "<td>" . htmlspecialchars($row['created_at']) . "</td>";
                print "<td>" . htmlspecialchars(ucfirst($row['action'])) . "</td>";
                print "<td>" . htmlspecialchars($row['feed_title'] ?: $row['feed_url']) . "</td>";
                print "<td>" . htmlspecialchars($row['feed_url']) . "</td>";
                print "<td>" . htmlspecialchars($row['category'] ?? '') . "</td>";
                print "<td>" . htmlspecialchars($row['note'] ?? '') . "</td>";
                print "<td>" . htmlspecialchars($row['reason'] ?? '') . "</td>";
                print "</tr>";
            }

            print "</table>";
        }

        print "</div>";
    }

    private function category_title($cat_id) {
        if (!$cat_id) return null;
        $cat = ORM::for_table('ttrss_feed_categories')->find_one($cat_id);
        return $cat ? $cat->title : null;
    }

    private function insert_log_row($owner_uid, $action, $feed_title, $feed_url, $category, $note, $reason) {
        $pdo = Db::pdo();
        $pdo->prepare("
            INSERT INTO ttrss_plugin_feed_subscription_log
                (owner_uid, action, feed_title, feed_url, category, note, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ")->execute([$owner_uid, $action, $feed_title, $feed_url, $category, $note, $reason]);
    }
}
