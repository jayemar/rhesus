// Rules for newspaper (full-fetch) view: the live article page, before and
// after Readability extracts the article from it. The result then goes
// through processArticleHtml() like any feed content.
//
// Everything here is a general rule that applies to every site. Comments
// name the site that prompted a rule, as an example of the pattern it
// handles. Rules keyed on one site's own markup go in siteRules.ts.

import { applySiteRules, HIGHLIGHT_BOX_CLASS } from './siteRules'
import { restrictIframesToAllowlist } from './embeds'

export const READABILITY_OPTIONS = { classesToPreserve: [HIGHLIGHT_BOX_CLASS] }

// Repairs the fetched page in place so Readability keeps what it would
// otherwise drop or mangle. pageUrl is the page's final URL.
export function prepareForReadability(doc: Document, pageUrl: string): void {
  doc.documentElement.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  const base = doc.createElement('base')
  base.setAttribute('href', pageUrl)
  doc.head.appendChild(base)
  // Drop caps (Jacobin: <p><span class="po-bo__dropcaps">B</span>y the...)
  // are the paragraph's own first letter, not UI - unwrap them to plain
  // text so the sweep below doesn't delete it.
  doc.querySelectorAll('p > b[class]:first-child, p > span[class]:first-child').forEach(el => {
    const text = el.textContent ?? ''
    if (/^\p{L}$/u.test(text.trim()) || /drop-?caps?/i.test(el.className)) el.replaceWith(text)
  })
  // Remove site UI control elements hidden by the original page's CSS/JS.
  // Applies to every site, not just the ones it was written for.
  doc.querySelectorAll('b[class], span[class]').forEach(el => el.remove())

  // Readability discards anything whose class/id contains "header" as page
  // chrome, which also takes out in-article section headings wrapped that
  // way (Jacobin: <header class="po-bo__header"><h2>...</h2></header>).
  // Unwrap when the heading is the wrapper's only child and body text
  // follows - the site's own masthead has neither.
  doc.querySelectorAll('h2, h3, h4').forEach(heading => {
    const wrapper = heading.parentElement
    if (!wrapper || wrapper.children.length !== 1) return
    if (!/header/i.test(`${wrapper.className} ${wrapper.id}`)) return
    if (!wrapper.nextElementSibling?.querySelector('p')) return
    wrapper.replaceWith(heading)
  })

  // Normalize image+caption div pairs to semantic <figure>/<figcaption> so
  // that sites like NPR (which don't use <figure>) get caption styling.
  doc.querySelectorAll('img:not(figure img)').forEach(img => {
    const picture = img.closest('picture')
    const imageNode = picture ?? img
    const imageWrapper = imageNode.parentElement
    if (!imageWrapper) return
    const captionSibling = imageWrapper.nextElementSibling
    if (!captionSibling) return
    const captionEl = captionSibling.querySelector('[class*="caption"] p, [aria-label*="caption"] p')
    if (!captionEl) return
    const text = captionEl.textContent?.trim()
    if (!text) return
    const grandParent = imageWrapper.parentElement
    if (!grandParent) return
    const figure = doc.createElement('figure')
    const figcaption = doc.createElement('figcaption')
    figcaption.textContent = text
    figure.appendChild(imageNode.cloneNode(true))
    figure.appendChild(figcaption)
    grandParent.insertBefore(figure, imageWrapper)
    imageWrapper.remove()
    captionSibling.remove()
  })

  // Readability's div-conditional-cleaning pass scores every <div> in the
  // document by its own class/id weight and link density, with no
  // awareness of a wrapping <blockquote> - a pull-quote whose CMS puts the
  // styling class on the <blockquote> itself (NPR does this) rather than
  // the inner <div> gets zero weight credit, so a short, link-heavy quote
  // (e.g. "...Listen to the full episode here") trips Readability's "low
  // weight and a little linky" rule and the whole <div> - text and all -
  // gets deleted, leaving an empty blockquote box. Unwrapping a <div>
  // that's the sole child of a <blockquote> first removes the div
  // Readability would flag, without touching the blockquote's actual text.
  doc.querySelectorAll('blockquote > div:only-child').forEach(div => {
    while (div.firstChild) div.parentNode?.insertBefore(div.firstChild, div)
    div.remove()
  })

  // Readability strips every class but "page" by default - site rules mark
  // highlight boxes with our own class first and READABILITY_OPTIONS tells
  // it to preserve that one, or the box styling never survives extraction.
  applySiteRules(doc)
  restrictIframesToAllowlist(doc, pageUrl)
}

// content is Readability's extracted HTML; heroImageUrl is the page's
// JSON-LD or og:image URL, read before Readability ran.
export function addHeroImageIfMissing(content: string, heroImageUrl: string | undefined, pageUrl: string): string {
  let rawContent = content
  // Readability is a text-density heuristic - on a page that's almost
  // entirely navigation chrome plus one image and near-zero body text
  // (a webcomic, say), it can score some unrelated boilerplate block
  // (a sitewide "join our Patreon" pitch, confirmed directly on a real
  // site) higher than the sparse element actually holding the real
  // content, and extract that instead - not a parse failure (article
  // is non-null), just a wrong pick, so the result.content fallback in
  // toggleFullContent() never triggers. When we independently know a hero
  // image exists (via JSON-LD or og:image, read before Readability ran)
  // and Readability's chosen content has no images of its own at all,
  // prepending it directly is a safe, strict improvement.
  //
  // Deliberately gated on "Readability kept zero images", not "doesn't
  // contain this exact URL" - an earlier version checked the latter and
  // it broke on a real, otherwise-fine extraction: a site's og:image is
  // frequently just a different-size variant of whatever image
  // Readability already kept (rte.ie: og:image's "-1600" suffix vs the
  // article's own "-800" suffix on the very same photo, confirmed
  // directly), and a plain string match misses that as "not present",
  // wrongly inserting a visible duplicate of the same photo. Checking
  // the image count instead of a specific URL match is immune to that -
  // it only ever fires when Readability's pick is genuinely image-less.
  const wrapper = new DOMParser().parseFromString(rawContent, 'text/html')
  if (heroImageUrl && wrapper.querySelectorAll('img').length === 0) {
    try {
      const absoluteUrl = new URL(heroImageUrl, pageUrl).href
      const figure = wrapper.createElement('figure')
      const img = wrapper.createElement('img')
      img.setAttribute('src', absoluteUrl)
      figure.appendChild(img)
      wrapper.body.insertBefore(figure, wrapper.body.firstChild)
      rawContent = wrapper.body.innerHTML
    } catch {
      // Malformed heroImageUrl - leave rawContent as Readability produced it.
    }
  }
  return rawContent
}
