export interface JsonLdArticleMeta {
  author?: string
  publishedAt?: number
  image?: string
}

function extractAuthorName(author: unknown): string | undefined {
  if (typeof author === 'string') return author.trim() || undefined
  if (Array.isArray(author)) {
    const names = author.map(extractAuthorName).filter((n): n is string => !!n)
    return names.length ? names.join(', ') : undefined
  }
  if (author && typeof author === 'object' && 'name' in author) {
    const name = (author as { name?: unknown }).name
    return typeof name === 'string' ? name.trim() || undefined : undefined
  }
  return undefined
}

function parseDate(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? undefined : Math.floor(ts / 1000)
}

// schema.org's "image" property is deliberately loose: a plain URL string,
// an array of them (first one wins here), or a full ImageObject node with
// its own .url. All three show up in the wild.
function extractImage(image: unknown): string | undefined {
  if (typeof image === 'string') return image.trim() || undefined
  if (Array.isArray(image)) {
    for (const entry of image) {
      const found = extractImage(entry)
      if (found) return found
    }
    return undefined
  }
  if (image && typeof image === 'object' && 'url' in image) {
    const url = (image as { url?: unknown }).url
    return typeof url === 'string' ? url.trim() || undefined : undefined
  }
  return undefined
}

function isArticleType(type: unknown): boolean {
  const types = Array.isArray(type) ? type : [type]
  return types.some((t) => typeof t === 'string' && /article/i.test(t))
}

function flattenNodes(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json.flatMap(flattenNodes)
  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>
    if (Array.isArray(obj['@graph'])) return obj['@graph'].flatMap(flattenNodes)
    return [obj]
  }
  return []
}

// Sites commonly embed one or more <script type="application/ld+json"> blocks
// for SEO rich snippets - either a flat object or an @graph array of
// interlinked nodes. We only care about the first node whose @type mentions
// "Article" (NewsArticle, BlogPosting, etc. all match), and only its
// author/datePublished/image fields.
export function extractJsonLdMeta(doc: Document): JsonLdArticleMeta {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]')
  for (const script of scripts) {
    let json: unknown
    try {
      json = JSON.parse(script.textContent ?? '')
    } catch {
      continue
    }
    const articleNode = flattenNodes(json).find((n) => isArticleType(n['@type']))
    if (!articleNode) continue
    const author = extractAuthorName(articleNode.author)
    const publishedAt = parseDate(articleNode.datePublished ?? articleNode.dateCreated)
    const image = extractImage(articleNode.image)
    if (author || publishedAt || image) return { author, publishedAt, image }
  }
  return {}
}
