export interface BasicPdfMetadata {
  title?: string
  authors?: string[]
  publicationYear?: number
  journal?: string
  doi?: string
}

// Very lightweight metadata extraction from raw PDF bytes using regex heuristics.
// This does not fully parse PDF; it targets common metadata locations (Info/XMP) and DOI patterns.
export function extractBasicPdfMetadata(buffer: Buffer): BasicPdfMetadata {
  const text = buffer.toString('latin1') // keep byte positions without utf8 decoding errors
  const meta: BasicPdfMetadata = {}

  try {
    // Info dictionary patterns like /Title (..), /Author (..), /CreationDate (D:YYYY...)
    const titleMatch = text.match(/\/Title\s*\(([^)]{1,200})\)/)
    if (titleMatch?.[1]) {
      meta.title = sanitize(titleMatch[1])
    }

    const authorMatch = text.match(/\/Author\s*\(([^)]{1,300})\)/)
    if (authorMatch?.[1]) {
      meta.authors = splitAuthors(sanitize(authorMatch[1]))
    }

    const dateMatch = text.match(/\/CreationDate\s*\(D:(\d{4})/)
    if (dateMatch?.[1]) {
      meta.publicationYear = safeYear(parseInt(dateMatch[1], 10))
    }

    // XMP Dublin Core title/creator if present (XML inside PDF)
    const xmpTitleMatch = text.match(/<dc:title>\s*<rdf:Alt>\s*<rdf:li[^>]*>([^<]{1,300})<\/rdf:li>/i)
    if (!meta.title && xmpTitleMatch?.[1]) {
      meta.title = sanitize(xmpTitleMatch[1])
    }

    const xmpAuthorsMatch = text.match(/<dc:creator>\s*<rdf:Seq>([\s\S]{1,2000})<\/rdf:Seq>\s*<\/dc:creator>/i)
    if (!meta.authors && xmpAuthorsMatch?.[1]) {
      const items = Array.from(xmpAuthorsMatch[1].matchAll(/<rdf:li[^>]*>([^<]{1,200})<\/rdf:li>/gi))
      if (items.length) meta.authors = items.map(m => sanitize(m[1]))
    }

    // DOI pattern search anywhere in bytes
    const doiMatch = text.match(/10\.\d{4,9}\/[\w\-._;()/:]+/)
    if (doiMatch?.[0]) {
      meta.doi = doiMatch[0]
    }

    // Try to infer year from other patterns if missing
    if (!meta.publicationYear) {
      const yearMatch = text.match(/\b(19|20)\d{2}\b/)
      if (yearMatch) meta.publicationYear = safeYear(parseInt(yearMatch[0], 10))
    }
  } catch {
    // best-effort; ignore errors
  }

  return meta
}

function sanitize(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function splitAuthors(s: string): string[] {
  // Common separators: comma, semicolon, 'and'
  const parts = s
    .split(/;|,|\band\b/gi)
    .map(p => sanitize(p))
    .filter(Boolean)
  // Merge initials like "J. Doe" split by comma
  return parts
}

function safeYear(y: number | undefined): number | undefined {
  if (!y) return undefined
  if (y < 1800 || y > new Date().getFullYear() + 1) return undefined
  return y
}

