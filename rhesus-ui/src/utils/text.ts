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

// Some WordPress sites (The Verge, at least) build a data-caption/
// data-portal-copyright attribute by HTML-entity-escaping an embedded
// <a href="...">...</a> (so < and > become &lt;/&gt;) but forget to also
// escape the embedded anchor's OWN quotes to &quot; - leaving raw,
// unescaped " characters inside an already-double-quoted attribute value,
// e.g. data-caption="... &lt;a href="https://example.com"&gt;text&lt;/a&gt;".
// A standard HTML parser has no way to know those inner quotes aren't the
// value's real terminator, so it ends the attribute early and the rest of
// the (now-unterminated) tag gets corrupted wholesale - not just the
// caption text, but the whole element, including its src attribute (i.e.
// the image itself can go missing, not just show a garbled caption).
//
// Repaired by finding the value's *real* end via lookahead for the next
// recognizable attribute/tag-close token (rather than assuming the first
// raw quote is the terminator), then escaping any raw quotes found inside.
export function fixUnescapedCaptionQuotes(html: string): string {
  return html.replace(
    /(data-caption|data-portal-copyright)="([\s\S]*?)"(?=\s+(?:data-[\w-]+=|src=|alt=|title=|fetchpriority=|class=|id=|width=|height=)|\s*\/?>)/g,
    (_match, attr: string, value: string) => `${attr}="${value.replace(/"/g, '&quot;')}"`,
  )
}
