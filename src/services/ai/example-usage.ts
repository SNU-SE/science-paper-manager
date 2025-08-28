/**
 * Example usage of the AI service abstraction layer
 * This file demonstrates how to use the AI services for paper analysis
 */

import { AIServiceFactory, MultiModelAnalyzer, AIProvider } from './index';

// Example paper data
const examplePaper = {
  id: 'paper-123',
  title: 'Machine Learning in Scientific Research',
  authors: ['Dr. Jane Smith', 'Dr. John Doe'],
  abstract: 'This paper explores the application of machine learning techniques in scientific research...',
  content: 'Full paper content would go here...'
};

// Example API keys (these would come from environment variables or user settings)
const apiKeys = {
  openai: process.env.OPENAI_API_KEY || '',
  anthropic: process.env.ANTHROPIC_API_KEY || '',
  xai: process.env.XAI_API_KEY || '',
  gemini: process.env.GEMINI_API_KEY || ''
};

/**
 * Example 1: Create and use a single AI service
 */
async function singleServiceExample() {
  try {
    // Create a single OpenAI service
    const openaiService = AIServiceFactory.createService({
      provider: 'openai',
      apiKey: apiKeys.openai
    });

    // Use the service to analyze a paper
    const summary = await openaiService.summarize(examplePaper.abstract || '');
    const keywords = await openaiService.extractKeywords(examplePaper.abstract || '');
    const relevance = await openaiService.analyzeRelevance(examplePaper.abstract || '');

    console.log('OpenAI Analysis Results:');
    console.log('Summary:', summary);
    console.log('Keywords:', keywords);
    console.log('Relevance:', relevance);
    console.log('Usage Stats:', openaiService.getLastUsageStats());
  } catch (error) {
    console.error('Single service example failed:', error);
  }
}

/**
 * Example 2: Use multiple AI services with MultiModelAnalyzer
 */
async function multiModelExample() {
  try {
    // Create service configurations for available providers
    const serviceConfigs = Object.entries(apiKeys)
      .filter(([_, key]) => key) // Only include providers with API keys
      .map(([provider, apiKey]) => ({
        provider: provider as AIProvider,
        apiKey
      }));

    // Create services using the factory
    const services = AIServiceFactory.createServices(serviceConfigs);

    // Create multi-model analyzer
    const analyzer = new MultiModelAnalyzer(services);

    console.log('Available providers:', analyzer.getAvailableProviders());

    // Analyze paper with all available models
    const analysis = await analyzer.analyzePaper(examplePaper);

    console.log('Multi-Model Analysis Results:');
    console.log('Paper ID:', analysis.paperId);
    console.log('Completed at:', analysis.completedAt);

    // Display results from each provider
    if (analysis.openai) {
      console.log('OpenAI Summary:', analysis.openai.summary);
      console.log('OpenAI Keywords:', analysis.openai.keywords);
    }

    if (analysis.anthropic) {
      console.log('Anthropic Summary:', analysis.anthropic.summary);
      console.log('Anthropic Keywords:', analysis.anthropic.keywords);
    }

    if (analysis.xai) {
      console.log('xAI Summary:', analysis.xai.summary);
      console.log('xAI Keywords:', analysis.xai.keywords);
    }

    if (analysis.gemini) {
      console.log('Gemini Summary:', analysis.gemini.summary);
      console.log('Gemini Keywords:', analysis.gemini.keywords);
    }
  } catch (error) {
    console.error('Multi-model example failed:', error);
  }
}

/**
 * Example 3: API key validation
 */
async function apiKeyValidationExample() {
  console.log('Validating API keys...');

  for (const [provider, apiKey] of Object.entries(apiKeys)) {
    if (apiKey) {
      try {
        const isValid = await AIServiceFactory.validateApiKey(provider as AIProvider, apiKey);
        console.log(`${provider}: ${isValid ? 'Valid' : 'Invalid'}`);
      } catch (error) {
        console.log(`${provider}: Validation failed -`, error);
      }
    } else {
      console.log(`${provider}: No API key provided`);
    }
  }
}

/**
 * Example 4: Selective model analysis
 */
async function selectiveAnalysisExample() {
  try {
    // Create services for all providers
    const serviceConfigs = Object.entries(apiKeys)
      .filter(([_, key]) => key)
      .map(([provider, apiKey]) => ({
        provider: provider as AIProvider,
        apiKey
      }));

    const services = AIServiceFactory.createServices(serviceConfigs);
    const analyzer = new MultiModelAnalyzer(services);

    // Analyze with only specific providers
    const selectedProviders: AIProvider[] = ['openai', 'anthropic'];
    const analysis = await analyzer.analyzePaper(examplePaper, selectedProviders);

    console.log('Selective Analysis Results:');
    console.log('Used providers:', selectedProviders);
    console.log('OpenAI result:', analysis.openai ? 'Available' : 'Not available');
    console.log('Anthropic result:', analysis.anthropic ? 'Available' : 'Not available');
    console.log('xAI result:', analysis.xai ? 'Available' : 'Not available');
    console.log('Gemini result:', analysis.gemini ? 'Available' : 'Not available');
  } catch (error) {
    console.error('Selective analysis example failed:', error);
  }
}

// Export examples for use in other files
export {
  singleServiceExample,
  multiModelExample,
  apiKeyValidationExample,
  selectiveAnalysisExample
};

// Run examples if this file is executed directly
if (require.main === module) {
  console.log('Running AI Service Examples...\n');
  
  Promise.resolve()
    .then(() => {
      console.log('=== Single Service Example ===');
      return singleServiceExample();
    })
    .then(() => {
      console.log('\n=== Multi-Model Example ===');
      return multiModelExample();
    })
    .then(() => {
      console.log('\n=== API Key Validation Example ===');
      return apiKeyValidationExample();
    })
    .then(() => {
      console.log('\n=== Selective Analysis Example ===');
      return selectiveAnalysisExample();
    })
    .then(() => {
      console.log('\nAll examples completed!');
    })
    .catch((error) => {
      console.error('Example execution failed:', error);
    });
}