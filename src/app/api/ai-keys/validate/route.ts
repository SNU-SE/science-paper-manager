import { NextRequest, NextResponse } from 'next/server'
import { AIServiceFactory } from '@/services/ai/AIServiceFactory'

export async function POST(request: NextRequest) {
  try {
    const { service, apiKey } = await request.json()

    if (!service || !apiKey) {
      return NextResponse.json(
        { error: 'Service and API key are required' },
        { status: 400 }
      )
    }

    if (!['openai', 'anthropic', 'xai', 'gemini'].includes(service)) {
      return NextResponse.json(
        { error: 'Invalid service' },
        { status: 400 }
      )
    }

    try {
      const aiService = AIServiceFactory.createService(service as any, apiKey)
      const isValid = await aiService.validateApiKey(apiKey)

      return NextResponse.json({
        service,
        isValid,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error(`Error validating ${service} API key:`, error)
      
      return NextResponse.json({
        service,
        isValid: false,
        error: 'Validation failed',
        timestamp: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error('Error in API key validation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}