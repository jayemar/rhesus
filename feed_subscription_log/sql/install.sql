-- Feed Subscription Log Plugin Database Schema (PostgreSQL)
-- Tracks feed subscribe/unsubscribe events, including the feed's note and
-- (for unsubscribes) an optional user-supplied reason.

CREATE TABLE IF NOT EXISTS ttrss_plugin_feed_subscription_log (
    id SERIAL PRIMARY KEY,
    owner_uid INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL,       -- 'subscribed' | 'unsubscribed'
    feed_title VARCHAR(255),
    feed_url VARCHAR(1024) NOT NULL,
    category VARCHAR(255),
    note TEXT,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_uid) REFERENCES ttrss_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feed_subscription_log_owner_uid ON ttrss_plugin_feed_subscription_log(owner_uid);
CREATE INDEX IF NOT EXISTS idx_feed_subscription_log_created_at ON ttrss_plugin_feed_subscription_log(created_at);

-- Reason/note submitted by the frontend just before an unsubscribe, so it can
-- reach hook_unsubscribe_feed() (which only receives feed_id/owner_uid).
-- Consumed and deleted by the hook handler when the log row is written.
CREATE TABLE IF NOT EXISTS ttrss_plugin_feed_subscription_log_pending (
    feed_id INTEGER PRIMARY KEY,
    owner_uid INTEGER NOT NULL,
    reason TEXT,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
