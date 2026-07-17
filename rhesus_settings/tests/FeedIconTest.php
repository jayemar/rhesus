<?php

namespace Tests;

use PHPUnit\Framework\TestCase;
use Rhesus_Settings;
use ORM;
use DiskCache;
use Config;
use UrlHelper;

// A 1x1 transparent PNG, valid enough for mime_content_type() to detect as
// image/png without needing a real file on disk (still written to a temp
// file, same as fetchIconFromUrl() itself does, so mime sniffing behaves
// identically to production).
const PNG_1PX = "\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0aIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\x0d\x0a\x2d\xb4\x00\x00\x00\x00IEND\xaeB`\x82";

final class FeedIconTest extends TestCase
{
    private Rhesus_Settings $plugin;

    protected function setUp(): void
    {
        ORM::reset();
        DiskCache::reset();
        Config::reset();
        UrlHelper::reset();
        $_REQUEST = [];
        $_SESSION = [];

        $this->plugin = new Rhesus_Settings();
    }

    private function seedFeed(int $id, int $ownerUid, array $overrides = []): void
    {
        ORM::seed('ttrss_feeds', array_merge([
            'id' => $id,
            'owner_uid' => $ownerUid,
            'title' => 'Test Feed',
            'favicon_is_custom' => false,
            'favicon_avg_color' => null,
            'favicon_last_checked' => null,
        ], $overrides));
    }

    private function feedRow(int $id): ?\FakeOrmRow
    {
        foreach (ORM::$tables['ttrss_feeds'] ?? [] as $row) {
            if ($row->id === $id) return $row;
        }
        return null;
    }

    // --- fetchIconFromUrl(): validation branches ---

    public function testFetchIconRequiresLogin(): void
    {
        $this->seedFeed(1, 42);
        $_REQUEST = ['feed_id' => 1, 'url' => 'http://example.com/icon.png'];
        // $_SESSION['uid'] deliberately left unset

        [$status, $content] = $this->plugin->fetchIconFromUrl();

        $this->assertSame(1, $status);
        $this->assertSame('NOT_LOGGED_IN', $content['error']);
        $this->assertEmpty(DiskCache::$storage);
    }

    public function testFetchIconRequiresFeedId(): void
    {
        $_SESSION['uid'] = 42;
        $_REQUEST = ['url' => 'http://example.com/icon.png'];

        [$status, $content] = $this->plugin->fetchIconFromUrl();

        $this->assertSame(1, $status);
        $this->assertSame('MISSING_FEED_ID', $content['error']);
    }

    public function testFetchIconRejectsUnknownFeed(): void
    {
        $_SESSION['uid'] = 42;
        $_REQUEST = ['feed_id' => 999, 'url' => 'http://example.com/icon.png'];

        [$status, $content] = $this->plugin->fetchIconFromUrl();

        $this->assertSame(1, $status);
        $this->assertSame('FEED_NOT_FOUND', $content['error']);
    }

    public function testFetchIconRejectsFeedOwnedByAnotherUser(): void
    {
        $this->seedFeed(1, 99); // belongs to a different user
        $_SESSION['uid'] = 42;
        $_REQUEST = ['feed_id' => 1, 'url' => 'http://example.com/icon.png'];

        [$status, $content] = $this->plugin->fetchIconFromUrl();

        $this->assertSame(1, $status);
        $this->assertSame('FEED_NOT_FOUND', $content['error']);
        $this->assertEmpty(DiskCache::$storage);
    }

    public function testFetchIconRequiresUrl(): void
    {
        $this->seedFeed(1, 42);
        $_SESSION['uid'] = 42;
        $_REQUEST = ['feed_id' => 1, 'url' => ''];

        [$status, $content] = $this->plugin->fetchIconFromUrl();

        $this->assertSame(1, $status);
        $this->assertSame('MISSING_URL', $content['error']);
    }

    public function testFetchIconRejectsNonHttpScheme(): void
    {
        $this->seedFeed(1, 42);
        $_SESSION['uid'] = 42;
        $_REQUEST = ['feed_id' => 1, 'url' => 'ftp://example.com/icon.png'];

        [$status, $content] = $this->plugin->fetchIconFromUrl();

        $this->assertSame(1, $status);
        $this->assertSame('INVALID_URL', $content['error']);
    }

    public function testFetchIconRejectsNonStandardPort(): void
    {
        $this->seedFeed(1, 42);
        $_SESSION['uid'] = 42;
        $_REQUEST = ['feed_id' => 1, 'url' => 'http://example.com:8080/icon.png'];

        [$status, $content] = $this->plugin->fetchIconFromUrl();

        $this->assertSame(1, $status);
        $this->assertSame('INVALID_URL', $content['error']);
    }

    // Uses literal IP addresses (not hostnames) so this exercises the
    // SSRF/private-range check without needing a real DNS lookup - gethostbyname()
    // on an IP literal just returns it unchanged.
    public function testFetchIconRejectsPrivateIpTargets(): void
    {
        $this->seedFeed(1, 42);
        $_SESSION['uid'] = 42;

        foreach (['http://127.0.0.1/icon.png', 'http://192.168.1.1/icon.png', 'http://169.254.169.254/icon.png'] as $url) {
            $_REQUEST = ['feed_id' => 1, 'url' => $url];
            [$status, $content] = $this->plugin->fetchIconFromUrl();
            $this->assertSame(1, $status, "expected $url to be rejected");
            $this->assertSame('INVALID_URL', $content['error'], "expected $url to be rejected as INVALID_URL");
        }
    }

    public function testFetchIconHandlesFetchFailure(): void
    {
        $this->seedFeed(1, 42);
        $_SESSION['uid'] = 42;
        $_REQUEST = ['feed_id' => 1, 'url' => 'http://example.com/icon.png'];
        UrlHelper::$next_result = false;
        UrlHelper::$fetch_last_error = 'connection refused';

        [$status, $content] = $this->plugin->fetchIconFromUrl();

        $this->assertSame(1, $status);
        $this->assertSame('FETCH_FAILED', $content['error']);
        $this->assertStringContainsString('connection refused', $content['message']);
    }

    public function testFetchIconRejectsOversizedFile(): void
    {
        $this->seedFeed(1, 42);
        $_SESSION['uid'] = 42;
        $_REQUEST = ['feed_id' => 1, 'url' => 'http://example.com/icon.png'];
        Config::$overrides[Config::MAX_FAVICON_FILE_SIZE] = 10; // bytes
        UrlHelper::$next_result = PNG_1PX; // well over 10 bytes

        [$status, $content] = $this->plugin->fetchIconFromUrl();

        $this->assertSame(1, $status);
        $this->assertSame('ICON_FILE_TOO_LARGE', $content['error']);
        $this->assertSame(10, $content['max_size']);
    }

    public function testFetchIconRejectsNonImageContent(): void
    {
        $this->seedFeed(1, 42);
        $_SESSION['uid'] = 42;
        $_REQUEST = ['feed_id' => 1, 'url' => 'http://example.com/icon.png'];
        UrlHelper::$next_result = "<html>not an image</html>";

        [$status, $content] = $this->plugin->fetchIconFromUrl();

        $this->assertSame(1, $status);
        $this->assertSame('ICON_INVALID_TYPE', $content['error']);
        $this->assertArrayHasKey('detected_type', $content);
    }

    // --- fetchIconFromUrl(): successful set ---

    public function testFetchIconSetsNewIconOnFeedWithNoExistingIcon(): void
    {
        $this->seedFeed(1, 42, ['favicon_is_custom' => false]);
        $_SESSION['uid'] = 42;
        $_REQUEST = ['feed_id' => 1, 'url' => 'http://example.com/icon.png'];
        UrlHelper::$next_result = PNG_1PX;

        [$status, $content] = $this->plugin->fetchIconFromUrl();

        $this->assertSame(0, $status);
        $this->assertSame('OK', $content['status']);
        $this->assertSame(PNG_1PX, DiskCache::instance('feed-icons')->get('1'));
        $feed = $this->feedRow(1);
        $this->assertTrue($feed->favicon_is_custom);
        $this->assertNull($feed->favicon_avg_color);
    }

    // The user's explicit "set a custom icon after a custom icon is already
    // set" workflow: a second successful fetch must overwrite the stored
    // bytes rather than erroring, duplicating, or leaving the old bytes.
    public function testFetchIconOverwritesAnAlreadyCustomIcon(): void
    {
        $this->seedFeed(1, 42, ['favicon_is_custom' => true, 'favicon_avg_color' => '#abcdef']);
        DiskCache::instance('feed-icons')->put('1', 'old-icon-bytes');
        $_SESSION['uid'] = 42;
        $_REQUEST = ['feed_id' => 1, 'url' => 'http://example.com/new-icon.png'];
        UrlHelper::$next_result = PNG_1PX;

        [$status, $content] = $this->plugin->fetchIconFromUrl();

        $this->assertSame(0, $status);
        $this->assertSame('OK', $content['status']);
        $this->assertSame(PNG_1PX, DiskCache::instance('feed-icons')->get('1'), 'old icon bytes should be replaced, not kept alongside the new ones');
        $feed = $this->feedRow(1);
        $this->assertTrue($feed->favicon_is_custom);
        $this->assertNull($feed->favicon_avg_color, 'avg color should be reset so it gets recalculated for the new icon');
    }

    public function testFetchIconAcceptsEveryAllowedMimeType(): void
    {
        // Only PNG is easy to fabricate a byte-perfect sample of; for the
        // rest we just confirm mime_content_type()'s detection of the magic
        // bytes lines up with what fetchIconFromUrl() allows, using the same
        // minimal signatures browsers/tools recognize.
        $samples = [
            'image/png' => PNG_1PX,
            'image/gif' => "GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;",
        ];

        foreach ($samples as $expectedMime => $bytes) {
            ORM::reset();
            DiskCache::reset();
            $this->seedFeed(1, 42);
            $_SESSION['uid'] = 42;
            $_REQUEST = ['feed_id' => 1, 'url' => 'http://example.com/icon'];
            UrlHelper::$next_result = $bytes;

            [$status, $content] = $this->plugin->fetchIconFromUrl();

            $this->assertSame(0, $status, "expected $expectedMime sample to be accepted, got: " . ($content['error'] ?? 'ok'));
        }
    }

    // --- removeFeedIcon(): validation branches ---

    public function testRemoveIconRequiresLogin(): void
    {
        $this->seedFeed(1, 42);
        $_REQUEST = ['feed_id' => 1];

        [$status, $content] = $this->plugin->removeFeedIcon();

        $this->assertSame(1, $status);
        $this->assertSame('NOT_LOGGED_IN', $content['error']);
    }

    public function testRemoveIconRequiresFeedId(): void
    {
        $_SESSION['uid'] = 42;
        $_REQUEST = [];

        [$status, $content] = $this->plugin->removeFeedIcon();

        $this->assertSame(1, $status);
        $this->assertSame('MISSING_FEED_ID', $content['error']);
    }

    public function testRemoveIconRejectsUnknownFeed(): void
    {
        $_SESSION['uid'] = 42;
        $_REQUEST = ['feed_id' => 999];

        [$status, $content] = $this->plugin->removeFeedIcon();

        $this->assertSame(1, $status);
        $this->assertSame('FEED_NOT_FOUND', $content['error']);
    }

    // --- removeFeedIcon(): successful removal ---

    public function testRemoveIconClearsAnExistingCustomIcon(): void
    {
        $this->seedFeed(1, 42, ['favicon_is_custom' => true, 'favicon_avg_color' => '#abcdef']);
        DiskCache::instance('feed-icons')->put('1', 'icon-bytes');
        $_SESSION['uid'] = 42;
        $_REQUEST = ['feed_id' => 1];

        [$status, $content] = $this->plugin->removeFeedIcon();

        $this->assertSame(0, $status);
        $this->assertSame('OK', $content['status']);
        $this->assertFalse(DiskCache::instance('feed-icons')->exists('1'));
        $feed = $this->feedRow(1);
        $this->assertFalse($feed->favicon_is_custom);
        $this->assertNull($feed->favicon_avg_color);
        $this->assertSame('1970-01-01', $feed->favicon_last_checked);
    }

    // Edge case: removing an icon that was never set (no DiskCache entry at
    // all) should succeed cleanly rather than erroring - there's nothing to
    // remove, but the feed's icon-state fields should still end up reset.
    public function testRemoveIconSucceedsWhenNoIconWasEverSet(): void
    {
        $this->seedFeed(1, 42, ['favicon_is_custom' => false]);
        $_SESSION['uid'] = 42;
        $_REQUEST = ['feed_id' => 1];

        [$status, $content] = $this->plugin->removeFeedIcon();

        $this->assertSame(0, $status);
        $this->assertSame('OK', $content['status']);
        $feed = $this->feedRow(1);
        $this->assertFalse($feed->favicon_is_custom);
        $this->assertNull($feed->favicon_avg_color);
    }

    // Edge case: removing twice in a row (e.g. a double-click, or a retried
    // request) should be idempotent - the second call has nothing left to
    // remove but must still succeed.
    public function testRemoveIconIsIdempotentWhenCalledTwice(): void
    {
        $this->seedFeed(1, 42, ['favicon_is_custom' => true]);
        DiskCache::instance('feed-icons')->put('1', 'icon-bytes');
        $_SESSION['uid'] = 42;
        $_REQUEST = ['feed_id' => 1];

        [$status1] = $this->plugin->removeFeedIcon();
        [$status2, $content2] = $this->plugin->removeFeedIcon();

        $this->assertSame(0, $status1);
        $this->assertSame(0, $status2);
        $this->assertSame('OK', $content2['status']);
    }

    // --- Cross-feed isolation ---

    // Guards against the icon-cache key or the feed lookup accidentally
    // being shared/global instead of scoped per feed_id.
    public function testIconOperationsOnOneFeedDoNotAffectAnother(): void
    {
        $this->seedFeed(1, 42);
        $this->seedFeed(2, 42);
        $_SESSION['uid'] = 42;

        $_REQUEST = ['feed_id' => 1, 'url' => 'http://example.com/icon.png'];
        UrlHelper::$next_result = PNG_1PX;
        $this->plugin->fetchIconFromUrl();

        $this->assertTrue(DiskCache::instance('feed-icons')->exists('1'));
        $this->assertFalse(DiskCache::instance('feed-icons')->exists('2'));
        $this->assertTrue($this->feedRow(1)->favicon_is_custom);
        $this->assertNotTrue($this->feedRow(2)->favicon_is_custom);

        $_REQUEST = ['feed_id' => 1];
        $this->plugin->removeFeedIcon();

        $this->assertFalse(DiskCache::instance('feed-icons')->exists('1'));
        $this->assertFalse($this->feedRow(1)->favicon_is_custom);
    }

    // --- Full round-trip workflow ---

    // Mirrors the actual workflow a user goes through in the Feed Editor:
    // set a custom icon, remove it, then set a (different) custom icon
    // again - each step should leave the feed in a clean, correct state
    // with no residue from earlier steps.
    public function testFullSetRemoveSetAgainWorkflow(): void
    {
        $this->seedFeed(1, 42);
        $_SESSION['uid'] = 42;

        // 1. Set the first custom icon.
        $_REQUEST = ['feed_id' => 1, 'url' => 'http://example.com/first.png'];
        UrlHelper::$next_result = PNG_1PX;
        [$status] = $this->plugin->fetchIconFromUrl();
        $this->assertSame(0, $status);
        $this->assertTrue($this->feedRow(1)->favicon_is_custom);
        $this->assertSame(PNG_1PX, DiskCache::instance('feed-icons')->get('1'));

        // 2. Remove it.
        $_REQUEST = ['feed_id' => 1];
        [$status] = $this->plugin->removeFeedIcon();
        $this->assertSame(0, $status);
        $this->assertFalse($this->feedRow(1)->favicon_is_custom);
        $this->assertFalse(DiskCache::instance('feed-icons')->exists('1'));

        // 3. Set a new custom icon again, after removal.
        $secondIcon = PNG_1PX . "\x00extra-bytes-to-differ";
        $_REQUEST = ['feed_id' => 1, 'url' => 'http://example.com/second.png'];
        UrlHelper::$next_result = $secondIcon;
        [$status, $content] = $this->plugin->fetchIconFromUrl();
        $this->assertSame(0, $status);
        $this->assertSame('OK', $content['status']);
        $this->assertTrue($this->feedRow(1)->favicon_is_custom);
        $this->assertNull($this->feedRow(1)->favicon_avg_color);
        $this->assertSame($secondIcon, DiskCache::instance('feed-icons')->get('1'));
    }
}
