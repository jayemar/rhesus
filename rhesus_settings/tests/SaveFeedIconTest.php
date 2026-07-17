<?php

namespace Tests;

use PHPUnit\Framework\TestCase;
use Rhesus_Settings;
use ORM;
use DiskCache;
use Config;

/**
 * Direct tests for Rhesus_Settings::saveFeedIcon() - the logic extracted out
 * of fetchIconFromUrl() and shared with upload_icon.php, so both paths
 * validate and store icon bytes identically from one place. FeedIconTest
 * already covers this indirectly through fetchIconFromUrl()'s own API
 * response shape; these test the static method itself as its own unit,
 * including that it's callable without ever instantiating Rhesus_Settings -
 * exactly how upload_icon.php calls it, since that script never runs
 * init() or otherwise constructs the plugin.
 */
final class SaveFeedIconTest extends TestCase
{
    protected function setUp(): void
    {
        ORM::reset();
        DiskCache::reset();
        Config::reset();
    }

    private function seedFeed(int $id, array $overrides = []): \FakeOrmRow
    {
        return ORM::seed('ttrss_feeds', array_merge([
            'id' => $id,
            'owner_uid' => 42,
            'favicon_is_custom' => false,
            'favicon_avg_color' => null,
        ], $overrides));
    }

    public function testSaveFeedIconIsCallableWithoutInstantiatingThePlugin(): void
    {
        $feed = $this->seedFeed(1);

        $result = Rhesus_Settings::saveFeedIcon($feed, PNG_1PX);

        $this->assertNull($result['error']);
    }

    public function testSaveFeedIconStoresBytesAndMarksFeedCustom(): void
    {
        $feed = $this->seedFeed(1);

        $result = Rhesus_Settings::saveFeedIcon($feed, PNG_1PX);

        $this->assertNull($result['error']);
        $this->assertSame(PNG_1PX, DiskCache::instance('feed-icons')->get('1'));
        $this->assertTrue($feed->favicon_is_custom);
        $this->assertNull($feed->favicon_avg_color);
    }

    public function testSaveFeedIconRejectsOversizedContent(): void
    {
        $feed = $this->seedFeed(1);
        Config::$overrides[Config::MAX_FAVICON_FILE_SIZE] = 10;

        $result = Rhesus_Settings::saveFeedIcon($feed, PNG_1PX);

        $this->assertSame('ICON_FILE_TOO_LARGE', $result['error']);
        $this->assertSame(10, $result['max_size']);
        $this->assertFalse(DiskCache::instance('feed-icons')->exists('1'));
    }

    public function testSaveFeedIconRejectsInvalidMimeType(): void
    {
        $feed = $this->seedFeed(1);

        $result = Rhesus_Settings::saveFeedIcon($feed, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

        $this->assertSame('ICON_INVALID_TYPE', $result['error']);
        $this->assertArrayHasKey('detected_type', $result);
        $this->assertFalse(DiskCache::instance('feed-icons')->exists('1'));
        $this->assertFalse($feed->favicon_is_custom, 'a rejected icon must not mark the feed as having a custom one');
    }

    // The same "custom after custom" workflow FeedIconTest checks through
    // fetchIconFromUrl(), verified directly at the shared-method level too,
    // since this is also exactly what upload_icon.php now relies on.
    public function testSaveFeedIconOverwritesAnAlreadyCustomIcon(): void
    {
        $feed = $this->seedFeed(1, ['favicon_is_custom' => true, 'favicon_avg_color' => '#123456']);
        DiskCache::instance('feed-icons')->put('1', 'old-bytes');

        $result = Rhesus_Settings::saveFeedIcon($feed, PNG_1PX);

        $this->assertNull($result['error']);
        $this->assertSame(PNG_1PX, DiskCache::instance('feed-icons')->get('1'));
        $this->assertTrue($feed->favicon_is_custom);
        $this->assertNull($feed->favicon_avg_color);
    }
}
