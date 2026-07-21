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
