<?php

namespace Tests;

use PHPUnit\Framework\TestCase;
use Rhesus_Settings;

/**
 * hook_feed_fetched() repairs common XML malformations before TT-RSS hands
 * the feed to LibXML. Each repair has to leave already-valid XML parseable,
 * so these check the output with a real XML parse as well as its text.
 */
final class FeedFetchedTest extends TestCase
{
    private function repair(string $xml): string
    {
        return (new Rhesus_Settings())->hook_feed_fetched($xml, 'https://example.com/feed', 1, 1);
    }

    private function assertParses(string $xml): void
    {
        $prev = libxml_use_internal_errors(true);
        libxml_clear_errors();
        $doc = new \DOMDocument();
        $ok = $doc->loadXML($xml);
        $errors = array_map(fn($e) => trim($e->message), libxml_get_errors());
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        $this->assertTrue($ok && !$errors, "XML failed to parse:\n" . implode("\n", $errors) . "\n\n" . $xml);
    }

    public function testExplicitlyClosedAtomLinksAreLeftAlone(): void
    {
        $atom = '<?xml version="1.0" encoding="utf-8"?>'
            . '<feed xmlns="http://www.w3.org/2005/Atom"><title>xkcd.com</title>'
            . '<link href="https://xkcd.com/" rel="alternate"></link>'
            . '<entry><title>A</title><link href="https://xkcd.com/1/" rel="alternate" ></link ></entry>'
            . '</feed>';

        $out = $this->repair($atom);

        $this->assertSame($atom, $out);
        $this->assertParses($out);
    }

    public function testUnclosedVoidElementsAreSelfClosed(): void
    {
        $rss = '<?xml version="1.0"?><rss><channel><title>T</title>'
            . '<link>https://example.com/</link>'
            . '<item><description><p>Hi<br><img src="a.png" alt="x"><link rel="stylesheet" href="s.css"></p></description></item>'
            . '</channel></rss>';

        $out = $this->repair($rss);

        $this->assertStringContainsString('<br/>', $out);
        $this->assertStringContainsString('<img src="a.png" alt="x"/>', $out);
        $this->assertStringContainsString('<link rel="stylesheet" href="s.css"/>', $out);
        $this->assertStringContainsString('<link>https://example.com/</link>', $out);
        $this->assertParses($out);
    }

    public function testAlreadySelfClosedLinksAreLeftAlone(): void
    {
        $atom = '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">'
            . '<link href="https://example.com/" rel="alternate"/></feed>';

        $this->assertSame($atom, $this->repair($atom));
    }
}
