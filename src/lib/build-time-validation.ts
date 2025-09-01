/**
 * Build-time environment variable validation
 * Validates critical environment variables during build process
 */

interface BuildTimeValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validates environment variables that are critical for deployment
 */
export function validateBuildTimeEnvironment(): BuildTimeValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Critical environment variables required for build-time (public variables only)
  const criticalVars = {
    'NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL,
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }

  // Check critical variables
  for (const [key, value] of Object.entries(criticalVars)) {
    if (!value || value.trim() === '') {
      errors.push(`Missing required environment variable: ${key}`)
    }
  }

  // Runtime variables that are recommended but not required for build
  const runtimeVars = {
    'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'REDIS_URL': process.env.REDIS_URL,
    'NEXTAUTH_SECRET': process.env.NEXTAUTH_SECRET,
    'NEXTAUTH_URL': process.env.NEXTAUTH_URL,
  }

  // Only warn about runtime variables, don't fail the build
  for (const [key, value] of Object.entries(runtimeVars)) {
    if (!value || value.trim() === '') {
      warnings.push(`Missing runtime environment variable: ${key} - some features may be disabled in production`)
    }
  }

  // Validate URL formats for critical variables only
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && !isValidUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    errors.push(`Invalid URL format for NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)
  }

  // Validate runtime URL formats (warn only)
  const runtimeUrlVars = ['REDIS_URL', 'NEXTAUTH_URL', 'DATABASE_URL']
  for (const varName of runtimeUrlVars) {
    const value = process.env[varName]
    if (value && !isValidUrl(value)) {
      warnings.push(`Invalid URL format for ${varName}: ${value} - this may cause runtime issues`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Simple URL validation
 */
function isValidUrl(string: string): boolean {
  try {
    new URL(string)
    return true
  } catch {
    return false
  }
}

/**
 * Run validation and throw error if critical issues found
 */
export function ensureBuildTimeEnvironmentIsValid(): void {
  const result = validateBuildTimeEnvironment()
  
  if (result.warnings.length > 0) {
    console.warn('⚠️  Build-time validation warnings:')
    result.warnings.forEach(warning => console.warn(`  - ${warning}`))
  }

  if (!result.isValid) {
    console.error('❌ Build-time validation failed:')
    result.errors.forEach(error => console.error(`  - ${error}`))
    throw new Error('Build-time environment validation failed')
  }

  console.log('✅ Build-time environment validation passed')
}

// Run validation during build if this file is imported
if (process.env.NODE_ENV === 'production' || process.env.BUILD_TIME_VALIDATION === 'true') {
  try {
    ensureBuildTimeEnvironmentIsValid()
  } catch (error) {
    console.error('Build failed due to environment validation:', error)
    process.exit(1)
  }
}