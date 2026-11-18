// Small helpers shared by the content rules and ArticleReader.vue.

// Strip HTML tags from a string to get plain text.
export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim()
}

// An <img> whose src is a placeholder that never got filled in (NPR has
// shipped src="undefined" literally) or a tracking pixel. See parseHero() in
// ArticleReader.vue for why these must go before resolveRelativeUrls().
export function isBrokenImageSrc(src: string): boolean {
  return src === 'undefined' || src === '' || src === 'null' || /\/tracking[/.]|[-_]pixel\./i.test(src)
}

export function removeBrokenImages(doc: Document): void {
  doc.querySelectorAll('img[src]').forEach(el => {
    if (isBrokenImageSrc(el.getAttribute('src') ?? '')) el.remove()
  })
}

export function resolveRelativeUrls(doc: Document, baseUrl: string | undefined): void {
  if (!baseUrl) return
  let base: URL
  try { base = new URL(baseUrl) } catch { return }
  // ArticleReader's normalizedContent deliberately strips our own TT-RSS
  // server's origin from /tt-rss/-rooted URLs (image cache paths, etc.) so
  // they resolve relative to whatever host the SPA is served from. Those
  // must not be re-absolutized
  // against the article's own site here, or they'd point at the wrong origin.
  doc.querySelectorAll('img[src]').forEach(el => {
    const src = el.getAttribute('src')
    if (src && !src.startsWith('http') && !src.startsWith('//') && !src.startsWith('data:') && !src.startsWith('/tt-rss/'))
      try { el.setAttribute('src', new URL(src, base).href) } catch {}
  })
  doc.querySelectorAll('a[href]').forEach(el => {
    const href = el.getAttribute('href')
    if (href && !href.startsWith('http') && !href.startsWith('//') && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('/tt-rss/'))
      try { el.setAttribute('href', new URL(href, base).href) } catch {}
  })
}
