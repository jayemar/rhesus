function hostname(url?: string): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

// For link-aggregator/wrapper feeds (Hacker News, Lobsters, etc.) where the
// feed's own site and an article's actual destination are different sites,
// returns the destination's hostname so the UI can surface it - e.g. an HN
// item whose feed is "Hacker News" but whose real link points to
// nytimes.com. Returns null when the article's link stays on the feed's own
// site (the common case), so normal blog/publication feeds don't get a
// redundant badge repeating what the feed name already says.
export function externalLinkDomain(link?: string, siteUrl?: string): string | null {
  const linkHost = hostname(link)
  const siteHost = hostname(siteUrl)
  if (!linkHost || !siteHost || linkHost === siteHost) return null
  return linkHost
}

// The destination domain's own homepage (protocol + host, no path) - for
// opening "the site this links to" rather than the specific article, which
// clicking the article title already covers.
export function originOf(url?: string): string | null {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}
