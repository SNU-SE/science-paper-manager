import { NextRequest, NextResponse } from 'next/server'
import { extractBasicPdfMetadata } from '@/lib/pdf-metadata'

export const runtime = 'nodejs'

type MetadataResponse = {
  title?: string
  authors?: string[]
  publicationYear?: number
  journal?: string
  doi?: string
  confidence: number
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    const openaiApiKey = (form.get('openaiApiKey') as string | null) || undefined

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const basic = extractBasicPdfMetadata(buffer)

    // Default response from basic extraction
    let response: MetadataResponse = {
      title: basic.title,
      authors: basic.authors,
      publicationYear: basic.publicationYear,
      journal: basic.journal,
      doi: basic.doi,
      confidence: 0.4,
    }

    // If no OpenAI key provided, return basic result only
    if (!openaiApiKey) {
      return NextResponse.json(response)
    }

    // Build a compact context from basic fields and a small snippet from bytes (XMP often text-based)
    const preview = buffer.toString('utf8').slice(0, 12000) // limit payload size
    const prompt = `You will refine scientific paper metadata extracted from a PDF. 
Given the rough fields and an optional raw text preview (may contain XML XMP or noise), return a strict JSON object with keys: title (string), authors (array of strings), publicationYear (number or null), journal (string or null), doi (string or null). Do not include any additional text.

Rough fields:
title: ${basic.title || ''}
authors: ${(basic.authors || []).join(', ')}
publicationYear: ${basic.publicationYear || ''}
journal: ${basic.journal || ''}
doi: ${basic.doi || ''}

Raw preview (may be incomplete/noisy):
${preview}
`

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You extract and normalize academic paper metadata and return strict JSON only.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      })

      if (!res.ok) {
        // If OpenAI fails, fall back silently to basic
        return NextResponse.json(response)
      }

      const data = await res.json()
      const content = data?.choices?.[0]?.message?.content
      if (content) {
        const refined = JSON.parse(content)
        response = {
          title: refined.title ?? response.title,
          authors: refined.authors ?? response.authors,
          publicationYear: refined.publicationYear ?? response.publicationYear,
          journal: refined.journal ?? response.journal,
          doi: refined.doi ?? response.doi,
          confidence: 0.8,
        }
      }
    } catch {
      // Ignore AI errors and use basic info
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('metadata extract error:', error)
    return NextResponse.json({ error: 'Failed to extract metadata' }, { status: 500 })
  }
}
