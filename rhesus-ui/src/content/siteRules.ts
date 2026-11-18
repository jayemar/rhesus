// Site-specific rules: each one is keyed on a particular site's or CMS's own
// markup (its class names), so it does nothing anywhere else. Everything in
// fullPage.ts and articleHtml.ts is a general rule instead.
//
// Rules run on feed content (articleHtml.ts) and, in newspaper view, on the
// fetched page before Readability (fullPage.ts) - so an article can pass
// through a rule twice, and each rule must leave already-handled markup
// alone.
//
// To add a site: add an entry with the site, an example article to check it
// against, and why the rule is needed. The styling for the classes these
// rules add lives in ArticleReader.vue.

export interface SiteRule {
  /** The site, or the CMS and the sites that use it. */
  site: string
  /** An article that shows the markup this rule handles. */
  example: string
  apply(doc: Document): void
}

// Readability strips every class it isn't told to keep, so this one is
// listed in READABILITY_OPTIONS (fullPage.ts).
export const HIGHLIGHT_BOX_CLASS = 'rhesus-highlight-box'

export const SITE_RULES: SiteRule[] = [
  {
    // Duet boxes off editorial asides - AMA plugs, related-coverage nudges -
    // in a "highlight" block that's visually set apart from the surrounding
    // body text on the original site. Left unmarked, it reads as an abrupt
    // topic change mid-article instead of a set-off aside.
    site: "Vox Media's Duet CMS (The Verge, Polygon, SB Nation, Eater, etc.)",
    example: 'https://www.theverge.com/',
    apply(doc) {
      doc.querySelectorAll('[class*="duet--article--highlight" i]').forEach((el) => {
        el.classList.add(HIGHLIGHT_BOX_CLASS)
      })
    },
  },
  {
    // "Did you know?" asides (div.insight). Their title is a
    // <p class="h4-style">, which Readability would strip down to a plain
    // paragraph, so it becomes a real heading here.
    site: 'Smithsonian Magazine',
    example: 'https://www.smithsonianmag.com/smart-news/more-than-a-billion-years-worth-of-rock-layers-are-missing-from-earths-geologic-record-scientists-say-they-may-finally-know-why-180989870/',
    apply(doc) {
      doc.querySelectorAll('div.insight').forEach((el) => {
        el.classList.add(HIGHLIGHT_BOX_CLASS)
        el.querySelectorAll('p.h4-style').forEach((p) => {
          const h = doc.createElement('h3')
          h.innerHTML = p.innerHTML
          p.replaceWith(h)
        })
      })
    },
  },
]

export function applySiteRules(doc: Document): void {
  for (const rule of SITE_RULES) rule.apply(doc)
}
