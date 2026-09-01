// Some feeds (old.reddit.com, at least) double-escape an invisible
// zero-width space they insert into post bodies - the raw feed source has
// "&amp;#x200B;" (Reddit's own "&#x200B;" with its "&" re-escaped for XML),
// which only unescapes once when read as HTML, so it survives as literal,
// visible text ("&#x200B;") instead of actually being invisible. A
// zero-width space has no legitimate visible use, so it's always safe to
// strip regardless of how many times it got escaped.
export function stripInvisibleEntityArtifacts(text: string): string {
  return text.replace(/&#x200B;|&#8203;/gi, '')
}

// The same double-escaping as above, but for entities that DO have a visible
// meaning. Some feeds (sandiegoreader.com's events feed, at least) escape tag
// markup once but the ampersand of a character entity twice, so the raw XML
// carries "&lt;p&gt;" alongside "s&amp;amp;iacute;ntomas". Reading that as XML
// yields HTML containing "&amp;iacute;", and reading *that* as HTML leaves the
// literal, visible text "&iacute;" where an "i" belonged.
//
// Deliberately operates on text nodes rather than on the HTML string: an
// attribute can legitimately contain "&amp;" (query strings such as
// "?op=cached&amp;file=..."), and rewriting those would corrupt URLs. Text
// node data is re-escaped when the tree is serialized, so decoding here can
// only ever produce text - it cannot introduce markup, and so cannot be used
// to smuggle anything past the sanitizer that runs afterwards.
//
// A residual entity is far more likely to be a mis-escaped feed than an
// author literally writing "&iacute;" and meaning it, so this decodes rather
// than second-guessing.
const RESIDUAL_ENTITY = /&(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#[xX][0-9a-fA-F]{1,6});/

export function decodeResidualEntities(root: Element): void {
  const doc = root.ownerDocument
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const stale: Text[] = []
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (RESIDUAL_ENTITY.test(node.data)) stale.push(node)
  }
  if (!stale.length) return
  const decoder = doc.createElement('textarea')
  for (const node of stale) {
    // <textarea> parses its content as text, so this decodes entities without
    // ever interpreting markup.
    decoder.innerHTML = node.data
    node.data = decoder.value
  }
}

// Some WordPress sites (The Verge's data-caption/data-portal-copyright
// attributes, at least) build a custom data-* attribute by HTML-entity-
// escaping an embedded <a href="...">...</a> (so < and > become &lt;/&gt;)
// but forget to also escape the embedded anchor's OWN quotes to &quot; -
// leaving raw, unescaped " characters inside an already-double-quoted
// attribute value, e.g.
// data-caption="... &lt;a href="https://example.com"&gt;text&lt;/a&gt;".
// A standard HTML parser has no way to know those inner quotes aren't the
// value's real terminator, so it ends the attribute early and the rest of
// the (now-unterminated) tag gets corrupted wholesale - not just the
// caption text, but the whole element, including its src attribute (i.e.
// the image itself can go missing, not just show a garbled caption).
//
// Deliberately matches any data-* attribute rather than hardcoding the two
// names seen in practice - the underlying bug (an embedded, badly-escaped
// anchor tag) isn't specific to The Verge's particular attribute naming,
// and this is a no-op for any data-* attribute that doesn't exhibit it
// (a well-formed value has no raw quotes to begin with, so the lazy match
// below just finds its already-correct boundary and rewrites it unchanged).
//
// Repaired by finding the value's *real* end via lookahead for the next
// recognizable attribute/tag-close token (rather than assuming the first
// raw quote is the terminator), then escaping any raw quotes found inside.
//
// The lookahead's attribute list is deliberately NOT exhaustive/generic
// (e.g. no "href=") - it must exclude any attribute name that could
// plausibly appear on the embedded, badly-escaped anchor tag itself
// (href, target, rel, ...), or the lookahead would stop too early, right
// after that inner attribute, and fail to find the real outer boundary.
// It only lists attributes expected on the *outer* element - confirmed
// missing "media=" broke a real <source data-srcset="..." media="..."/>
// tag (GAA.ie): the lookahead skipped straight past data-srcset's real end
// looking for a recognized next attribute, swallowed `media="..."` whole
// into the data-srcset value, and produced a garbled, unloadable image URL.
export function fixUnescapedDataAttributeQuotes(html: string): string {
  return html.replace(
    /(data-[\w-]+)="([\s\S]*?)"(?=\s+(?:data-[\w-]+=|src=|alt=|title=|fetchpriority=|class=|id=|width=|height=|media=|sizes=|srcset=|loading=|decoding=|style=|role=)|\s*\/?>)/g,
    (_match, attr: string, value: string) => `${attr}="${value.replace(/"/g, '&quot;')}"`,
  )
}
