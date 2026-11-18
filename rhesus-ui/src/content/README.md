# Article content rules

How Rhesus turns feed content and fetched article pages into what the reader
shows. `ArticleReader.vue` calls into these; the CSS for the classes they add
(`rhesus-highlight-box`, `rhesus-pull-quote`, `rhesus-embed-fallback`, ...)
stays in the component.

| File | What's in it | Scope |
|---|---|---|
| `siteRules.ts` | Rules keyed on one site's or CMS's own markup, each with an example article | **Site-specific** |
| `embeds.ts` | Social embeds (Twitter/X, Instagram, TikTok, Facebook) and the iframe allowlist (YouTube, Vimeo, tweets) | Per embed platform |
| `fullPage.ts` | Newspaper view: repairs to the fetched page before Readability, and the hero image fallback after it | General |
| `articleHtml.ts` | Every article as displayed (feed content, and Readability's output): sanitizing, captions, blockquotes, pull quotes, images, tables | General |
| `html.ts` | Shared helpers: tag stripping, broken image removal, relative URL resolution | - |

## Order

Default view: feed content → `processArticleHtml()`.

Newspaper view: fetched page → `prepareForReadability()` → Readability →
`addHeroImageIfMissing()` → DOMPurify → `processArticleHtml()`.

Site rules run inside both `prepareForReadability()` and
`processArticleHtml()`, so a rule can see the same article twice and must
leave markup it has already handled alone.

## Site-specific or general?

A general rule matches on structure or on naming conventions shared across
sites, and applies everywhere. Its comment may name the site that prompted
it (Jacobin's drop caps, NPR's captions) as an example of the pattern.

A rule that matches one site's own class names goes in `siteRules.ts`,
even if it's a one-liner, so it's clear it does nothing anywhere else.
