// Embedded media: social-platform widgets and third-party iframes. These
// rules are keyed on the embed platform (Twitter/X, Instagram, YouTube...),
// not on the site publishing the article.

// Twitter/X embeds ship as the same empty-placeholder-plus-script pattern as
// the other platforms fallbackEmptyEmbeds() below handles (a <blockquote
// class="twitter-tweet"> that platform.twitter.com/widgets.js replaces with
// a live iframe client-side) - but unlike Instagram, a logged-out viewer can
// actually see a public tweet's embed (confirmed directly: the widget still
// renders for anonymous visitors as of October 2026), so this builds that
// same iframe ourselves instead of falling back to a plain link. Must run
// before fallbackEmptyEmbeds() so a converted blockquote never reaches it,
// and before DOMPurify.sanitize() since the permalink lives in a child <a>
// href, which survives sanitization, but the <blockquote> itself wouldn't
// survive being swapped for a bare <iframe> after the fact.
export function convertTwitterEmbeds(doc: Document) {
  doc.querySelectorAll('blockquote.twitter-tweet').forEach((el) => {
    // The tweet's own permalink is the one child link whose path ends in
    // /status/<id> - earlier links inside the blockquote are often to
    // mentions/hashtags within the tweet text itself, not the tweet.
    const statusHref = Array.from(el.querySelectorAll('a[href]'))
      .map(a => a.getAttribute('href') ?? '')
      .find(href => /\/status\/\d+/.test(href))
    const tweetId = statusHref?.match(/\/status\/(\d+)/)?.[1]
    // No parseable permalink - leave the blockquote as-is for
    // fallbackEmptyEmbeds() below to handle the usual way.
    if (!tweetId) return
    const iframe = doc.createElement('iframe')
    iframe.setAttribute('src', `https://platform.twitter.com/embed/Tweet.html?id=${tweetId}`)
    iframe.setAttribute('loading', 'lazy')
    iframe.className = 'rhesus-twitter-embed'
    el.replaceWith(iframe)
  })
}

// Social embed widgets (Instagram, TikTok, Facebook, etc.) ship as an empty
// placeholder element plus a <script> that a real browser on the origin
// site uses to fetch and render the actual embed client-side. That script
// never runs here (DOMPurify strips it, and tracker-blockers like Privacy
// Badger would block it anyway even if it did), so the placeholder renders
// as a blank box. Must run before DOMPurify.sanitize() - the permalink is
// usually itself a data-* attribute, which DOMPurify strips by default.
export function fallbackEmptyEmbeds(doc: Document) {
  const selector = [
    'blockquote.instagram-media',
    'blockquote.twitter-tweet',
    'blockquote.tiktok-embed',
    'blockquote.fb-xfbml-parse-ignore',
    'div.fb-video',
    'div.fb-post',
    // A <canvas> element (e.g. a Chart.js graph) is only ever populated by
    // JavaScript, which never runs here - it otherwise sits as a large,
    // completely blank box reserving its declared width/height (a "hero
    // image" -shaped gap with nothing in it). No permalink-style attribute
    // to recover a source link from, so this always falls through to the
    // plain "content removed" note below rather than a "View on..." link.
    'canvas',
  ].join(',')
  doc.querySelectorAll(selector).forEach((el) => {
    // Some platforms (Twitter's static fallback markup, most TikTok embeds)
    // already include real, readable text - leave those alone entirely.
    // Instagram is the one exception: whenever data-instgrm-captioned is
    // set, its skeleton-loader placeholder bakes in text too ("View this
    // post on Instagram" / "A post shared by X") - but that's always
    // generic boilerplate, never the post's actual caption or content, so
    // it's never worth keeping over the small fallback link below. Left
    // as-is, it renders as a large, mostly-empty box sized to match the
    // real embed that never loads.
    const isInstagram = el.matches('blockquote.instagram-media')
    if (!isInstagram && el.textContent?.trim()) return
    const url =
      el.getAttribute('data-instgrm-permalink') ||
      el.getAttribute('cite') ||
      el.getAttribute('data-href') ||
      el.querySelector('a[href]')?.getAttribute('href') ||
      null
    if (!url) {
      const note = doc.createElement('p')
      note.className = 'rhesus-embed-removed'
      note.textContent = 'Embedded content removed - open the original article to view it.'
      el.replaceWith(note)
      return
    }
    const link = doc.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener noreferrer')
    link.className = 'rhesus-embed-fallback'
    link.textContent = `View on ${embedPlatformName(url)} ↗`
    el.replaceWith(link)
  })
}

function embedPlatformName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host.includes('instagram')) return 'Instagram'
    if (host.includes('tiktok')) return 'TikTok'
    if (host === 'x.com' || host.includes('twitter')) return 'X'
    if (host.includes('facebook')) return 'Facebook'
    return host
  } catch {
    return 'original post'
  }
}

// Trusted video-embed providers whose <iframe> we let through. DOMPurify's
// default config strips every <iframe> outright - for good reason, since an
// arbitrary third-party iframe can host anything from a phishing page to an
// invisible tracking frame - so carving out an exception means narrowing to
// a short list of known, single-purpose embed origins first, checked by
// hostname *and* the provider's own embed-path convention (an arbitrary
// youtube.com page is not the same trust boundary as the embed player
// itself, even though they share a host).
const IFRAME_EMBED_ALLOWLIST: { hosts: string[], pathPrefix: string }[] = [
  { hosts: ['youtube.com', 'www.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'], pathPrefix: '/embed/' },
  { hosts: ['player.vimeo.com'], pathPrefix: '/video/' },
  // Only the single-tweet embed path (see convertTwitterEmbeds()) - not the
  // whole of platform.twitter.com, which also hosts timeline/moment widgets
  // this isn't built to generate or vouch for.
  { hosts: ['platform.twitter.com'], pathPrefix: '/embed/Tweet.html' },
]

function isAllowedEmbedSrc(src: string, base: string): boolean {
  try {
    const url = new URL(src, base)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    return IFRAME_EMBED_ALLOWLIST.some(({ hosts, pathPrefix }) =>
      hosts.includes(url.hostname) && url.pathname.startsWith(pathPrefix))
  } catch {
    return false
  }
}

// Must run before DOMPurify.sanitize() - and before that call is given
// ADD_TAGS: ['iframe'] to let any <iframe> at all survive - so that only
// ones already confirmed trusted here are still present by the time that
// exception applies. An iframe failing the allowlist is simply removed, the
// same outcome DOMPurify's own default (no iframe support at all) already
// produces for it today.
export function restrictIframesToAllowlist(doc: Document, base: string): void {
  doc.querySelectorAll('iframe').forEach((el) => {
    const src = el.getAttribute('src')
    if (!src || !isAllowedEmbedSrc(src, base)) {
      el.remove()
    }
  })
}

// Shared by both content pipelines (processArticleHtml() and
// ArticleReader's toggleFullContent()) so the allowed attribute/tag set can't drift between
// them.
export const IFRAME_SANITIZE_CONFIG = {
  ADD_TAGS: ['iframe'],
  ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'loading', 'referrerpolicy'],
}
