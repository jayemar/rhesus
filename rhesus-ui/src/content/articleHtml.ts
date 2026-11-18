// Rules for article HTML as it is displayed: feed content in the default
// view, and Readability's output in newspaper view. Runs DOMPurify, so
// anything that needs data-* attributes or elements DOMPurify drops has to
// happen before the sanitize call.
//
// Everything here is a general rule that applies to every site. Comments
// name the site that prompted a rule, as an example of the pattern it
// handles. Rules keyed on one site's own markup go in siteRules.ts.

import DOMPurify from 'dompurify'
import { stripInvisibleEntityArtifacts, fixUnescapedDataAttributeQuotes, decodeResidualEntities, restoreEscapedInlineTags } from '@/utils/text'
import { stripHtml, removeBrokenImages, resolveRelativeUrls } from './html'
import { convertTwitterEmbeds, fallbackEmptyEmbeds, restrictIframesToAllowlist, IFRAME_SANITIZE_CONFIG } from './embeds'
import { applySiteRules } from './siteRules'

export function processArticleHtml(html: string, articleLink: string | undefined): string {
  // Preprocess before DOMPurify strips data-* attributes: move data-caption
  // into alt (for lightbox) and figcaption (for below-image display) when empty.
  const pre = new DOMParser().parseFromString(fixUnescapedDataAttributeQuotes(stripInvisibleEntityArtifacts(html)), 'text/html')
  removeBrokenImages(pre)
  // Repair entities the feed escaped one level too many (see text.ts). Done
  // on the parsed tree so attribute values, where a bare &amp; is legitimate,
  // are left alone.
  decodeResidualEntities(pre.body)
  restoreEscapedInlineTags(pre.body)
  resolveRelativeUrls(pre, articleLink)
  convertTwitterEmbeds(pre)
  fallbackEmptyEmbeds(pre)
  restrictIframesToAllowlist(pre, articleLink ?? location.href)
  pre.querySelectorAll('img[data-caption]').forEach(img => {
    const dc = img.getAttribute('data-caption') ?? ''
    const dcText = stripHtml(dc)
    if (!dcText) return
    const fig = img.closest('figure')
    if (fig) {
      const fc = fig.querySelector('figcaption')
      if (fc && !fc.textContent?.trim()) fc.textContent = dcText
    } else {
      const figure = pre.createElement('figure')
      const figcaption = pre.createElement('figcaption')
      figcaption.textContent = dcText
      img.parentNode?.insertBefore(figure, img)
      figure.appendChild(img)
      figure.appendChild(figcaption)
    }
  })
  const sanitized = DOMPurify.sanitize(pre.body.innerHTML, IFRAME_SANITIZE_CONFIG)
  const doc = new DOMParser().parseFromString(sanitized, 'text/html')
  // A read-only sanitized article body has no legitimate use for an
  // interactive <button> - some feeds (Substack's image zoom/enlarge
  // controls, embedded directly in content:encoded) ship them anyway.
  // DOMPurify's default allowlist permits <button>/<svg> as ordinary,
  // non-dangerous HTML, so they survive sanitization and render as inert
  // icon clutter unless removed here.
  doc.querySelectorAll('button').forEach(el => el.remove())
  // Line breaks with nothing after them but whitespace or a closing bracket
  // before the paragraph ends only add blank lines - NPR's image credits come
  // as "(Image credit: Name<br/><br/>)", which rendered as three lines with
  // the ")" alone on the last.
  doc.querySelectorAll('p br, figcaption br').forEach(br => {
    let n = br.nextSibling
    while (n && (n.nodeName === 'BR' || (n.nodeType === Node.TEXT_NODE && /^[\s)\]]*$/.test(n.textContent ?? '')))) {
      n = n.nextSibling
    }
    if (!n) br.remove()
  })
  // A blockquote can end up with no real content for reasons outside our
  // control (Readability stripping a div-wrapped quote it judged "shady",
  // a malformed feed, etc.) - the CSS below still borders/backgrounds it
  // regardless, so leaving it in place renders as a visibly broken,
  // decorated box with nothing inside. Drop it outright instead. A
  // blockquote embedding only media (no text) is left alone - that's not
  // "empty" in the sense that matters here.
  doc.querySelectorAll('blockquote').forEach(bq => {
    const hasText = !!bq.textContent?.trim()
    const hasMedia = !!bq.querySelector('img, video, iframe, svg')
    if (!hasText && !hasMedia) bq.remove()
  })
  // Some sites wrap a pull quote in an outer <blockquote> used purely as a
  // styling frame, with the actual quote in a nested <blockquote> inside it.
  // Hearst's pattern is:
  //   <blockquote data-theme-key="pullquote">
  //     <span aria-hidden="true"></span>          (empty, decorative)
  //     <blockquote>the actual quote</blockquote>
  //     <span aria-hidden="true"></span>
  //   </blockquote>
  // Their CSS turns the outer into a pull-quote frame; here both are just
  // <blockquote>, so the reader draws two sets of indent and border, one
  // inside the other. Collapse the outer when it contributes nothing of its
  // own. A genuine quote-within-a-quote has its own text or media alongside
  // the nested one, and is left alone.
  doc.querySelectorAll('blockquote > blockquote').forEach(inner => {
    const outer = inner.parentElement
    if (!outer || outer.querySelectorAll('blockquote').length !== 1) return
    const ownNodes = Array.from(outer.childNodes).filter(n => n !== inner)
    if (ownNodes.some(n => (n.textContent ?? '').trim())) return
    // matches() as well as querySelector(): the media may *be* the sibling
    // node rather than sit inside it.
    const MEDIA = 'img, video, iframe, svg'
    if (ownNodes.some(n => n instanceof Element && (n.matches(MEDIA) || n.querySelector(MEDIA)))) return
    // Carry the outer's classes over so the pull-quote marker set above (and
    // any site class markPullQuotes matches on) survives the unwrap.
    outer.classList.forEach(c => inner.classList.add(c))
    outer.replaceWith(inner)
  })
  markPullQuotes(doc)
  applySiteRules(doc)
  // Defer decoding of article images until they approach the viewport. Without
  // this the browser decodes every image in the article at once, at full
  // natural resolution regardless of the max-width: 100% it is displayed at -
  // a long full-fetched article can hold hundreds of MB of decoded bitmaps.
  // On a memory-pressured device that starves the graphics caches, and the
  // first thing to fall over is the glyph atlas: shapes still paint while text
  // vanishes (see READER-KEYBOARD-VIEWPORT-FLASH.md). Applied after
  // DOMPurify.sanitize() above, which would otherwise strip these attributes.
  doc.querySelectorAll('img').forEach(img => {
    img.setAttribute('loading', 'lazy')
    img.setAttribute('decoding', 'async')
  })
  doc.querySelectorAll('table').forEach(table => {
    const wrapper = doc.createElement('div')
    wrapper.className = 'table-scroll'
    table.parentNode?.insertBefore(wrapper, table)
    wrapper.appendChild(table)
  })
  return doc.body.innerHTML
}

// Pull quotes are an editorial/typographic device (usually a sentence
// repeated from the surrounding body text, set apart for emphasis) rather
// than a real quotation - there's no HTML5 semantic element for them the
// way <blockquote> covers actual quotes. The de facto convention across
// CMSs is a class name containing some form of "pull quote", so that's the
// only generally reliable signal available.
export function markPullQuotes(doc: Document) {
  doc.querySelectorAll('[class*="pull-quote" i], [class*="pullquote" i], [class*="pull_quote" i]').forEach((el) => {
    // A bare <span> match is usually centered inside a wrapping <p> (e.g.
    // Tricycle: <p style="text-align:center"><span class="pull-quote">...).
    // Marking the <span> itself would only box the inline text, not the
    // paragraph - style the wrapping block instead when there is one.
    const target = el.tagName === 'SPAN' ? (el.closest('p') ?? el) : el
    target.classList.add('rhesus-pull-quote')
  })
}
