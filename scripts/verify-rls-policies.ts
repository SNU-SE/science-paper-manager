#!/usr/bin/env tsx

/**
 * Script to verify RLS (Row Level Security) policies are working correctly
 * This script tests that users can only access their own data
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

// Create clients
const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
const anonClient = createClient(supabaseUrl, supabaseAnonKey)

interface TestResult {
  test: string
  passed: boolean
  error?: string
}

const results: TestResult[] = []

function addResult(test: string, passed: boolean, error?: string) {
  results.push({ test, passed, error })
  const status = passed ? '✅ PASS' : '❌ FAIL'
  console.log(`${status}: ${test}`)
  if (error) {
    console.log(`   Error: ${error}`)
  }
}

async function createTestUsers() {
  console.log('\n🔧 Creating test users...')
  
  // Create two test users
  const { data: user1, error: error1 } = await serviceClient.auth.admin.createUser({
    email: 'test1@example.com',
    password: 'testpassword123',
    email_confirm: true
  })
  
  const { data: user2, error: error2 } = await serviceClient.auth.admin.createUser({
    email: 'test2@example.com',
    password: 'testpassword123',
    email_confirm: true
  })
  
  if (error1 || error2) {
    console.error('Failed to create test users:', error1 || error2)
    return null
  }
  
  console.log(`Created test users: ${user1.user?.id} and ${user2.user?.id}`)
  return {
    user1: user1.user!,
    user2: user2.user!
  }
}

async function cleanupTestUsers(user1Id: string, user2Id: string) {
  console.log('\n🧹 Cleaning up test users...')
  
  await serviceClient.auth.admin.deleteUser(user1Id)
  await serviceClient.auth.admin.deleteUser(user2Id)
  
  console.log('Test users cleaned up')
}

async function testUserApiKeysRLS(user1Id: string, user2Id: string) {
  console.log('\n🔐 Testing user_api_keys RLS policies...')
  
  // Insert test data as service role (bypasses RLS)
  const testApiKey = {
    user_id: user1Id,
    provider: 'openai',
    api_key_encrypted: 'encrypted_test_key',
    api_key_hash: 'test_hash'
  }
  
  const { error: insertError } = await serviceClient
    .from('user_api_keys')
    .insert(testApiKey)
  
  if (insertError) {
    addResult('Insert test API key', false, insertError.message)
    return
  }
  
  // Test 1: User can read their own API keys
  const user1Client = createClient(supabaseUrl, supabaseAnonKey)
  await user1Client.auth.signInWithPassword({
    email: 'test1@example.com',
    password: 'testpassword123'
  })
  
  const { data: ownKeys, error: ownKeysError } = await user1Client
    .from('user_api_keys')
    .select('*')
    .eq('user_id', user1Id)
  
  addResult(
    'User can read own API keys',
    !ownKeysError && ownKeys?.length === 1,
    ownKeysError?.message
  )
  
  // Test 2: User cannot read other user's API keys
  const { data: otherKeys, error: otherKeysError } = await user1Client
    .from('user_api_keys')
    .select('*')
    .eq('user_id', user2Id)
  
  addResult(
    'User cannot read other user\'s API keys',
    !otherKeysError && otherKeys?.length === 0,
    otherKeysError?.message
  )
  
  // Test 3: User cannot insert API key for another user
  const { error: insertOtherError } = await user1Client
    .from('user_api_keys')
    .insert({
      user_id: user2Id,
      provider: 'anthropic',
      api_key_encrypted: 'malicious_key',
      api_key_hash: 'malicious_hash'
    })
  
  addResult(
    'User cannot insert API key for another user',
    !!insertOtherError,
    insertOtherError ? 'Correctly blocked' : 'Should have been blocked'
  )
  
  // Test 4: Anonymous user cannot access any API keys
  await user1Client.auth.signOut()
  
  const { data: anonKeys, error: anonError } = await anonClient
    .from('user_api_keys')
    .select('*')
  
  addResult(
    'Anonymous user cannot access API keys',
    !!anonError || anonKeys?.length === 0,
    anonError?.message || 'No error but should be blocked'
  )
  
  // Cleanup
  await serviceClient
    .from('user_api_keys')
    .delete()
    .eq('user_id', user1Id)
}

async function testUserAiModelPreferencesRLS(user1Id: string, user2Id: string) {
  console.log('\n🤖 Testing user_ai_model_preferences RLS policies...')
  
  // Insert test data
  const testPreference = {
    user_id: user1Id,
    provider: 'openai',
    model_name: 'gpt-4',
    is_default: true,
    parameters: { temperature: 0.7 }
  }
  
  const { error: insertError } = await serviceClient
    .from('user_ai_model_preferences')
    .insert(testPreference)
  
  if (insertError) {
    addResult('Insert test AI model preference', false, insertError.message)
    return
  }
  
  // Test with authenticated user
  const user1Client = createClient(supabaseUrl, supabaseAnonKey)
  await user1Client.auth.signInWithPassword({
    email: 'test1@example.com',
    password: 'testpassword123'
  })
  
  // Test 1: User can read own preferences
  const { data: ownPrefs, error: ownPrefsError } = await user1Client
    .from('user_ai_model_preferences')
    .select('*')
    .eq('user_id', user1Id)
  
  addResult(
    'User can read own AI model preferences',
    !ownPrefsError && ownPrefs?.length === 1,
    ownPrefsError?.message
  )
  
  // Test 2: User cannot read other user's preferences
  const { data: otherPrefs, error: otherPrefsError } = await user1Client
    .from('user_ai_model_preferences')
    .select('*')
    .eq('user_id', user2Id)
  
  addResult(
    'User cannot read other user\'s AI model preferences',
    !otherPrefsError && otherPrefs?.length === 0,
    otherPrefsError?.message
  )
  
  // Cleanup
  await serviceClient
    .from('user_ai_model_preferences')
    .delete()
    .eq('user_id', user1Id)
}

async function testUserZoteroSettingsRLS(user1Id: string, user2Id: string) {
  console.log('\n📚 Testing user_zotero_settings RLS policies...')
  
  // Insert test data
  const testZoteroSettings = {
    user_id: user1Id,
    api_key_encrypted: 'encrypted_zotero_key',
    user_id_zotero: '123456',
    library_type: 'user',
    auto_sync: false,
    sync_interval: 3600
  }
  
  const { error: insertError } = await serviceClient
    .from('user_zotero_settings')
    .insert(testZoteroSettings)
  
  if (insertError) {
    addResult('Insert test Zotero settings', false, insertError.message)
    return
  }
  
  // Test with authenticated user
  const user1Client = createClient(supabaseUrl, supabaseAnonKey)
  await user1Client.auth.signInWithPassword({
    email: 'test1@example.com',
    password: 'testpassword123'
  })
  
  // Test 1: User can read own Zotero settings
  const { data: ownSettings, error: ownSettingsError } = await user1Client
    .from('user_zotero_settings')
    .select('*')
    .eq('user_id', user1Id)
  
  addResult(
    'User can read own Zotero settings',
    !ownSettingsError && ownSettings?.length === 1,
    ownSettingsError?.message
  )
  
  // Test 2: User cannot read other user's Zotero settings
  const { data: otherSettings, error: otherSettingsError } = await user1Client
    .from('user_zotero_settings')
    .select('*')
    .eq('user_id', user2Id)
  
  addResult(
    'User cannot read other user\'s Zotero settings',
    !otherSettingsError && otherSettings?.length === 0,
    otherSettingsError?.message
  )
  
  // Cleanup
  await serviceClient
    .from('user_zotero_settings')
    .delete()
    .eq('user_id', user1Id)
}

async function testUserGoogleDriveSettingsRLS(user1Id: string, user2Id: string) {
  console.log('\n☁️ Testing user_google_drive_settings RLS policies...')
  
  // Insert test data
  const testGoogleDriveSettings = {
    user_id: user1Id,
    client_id: 'test_client_id',
    client_secret: 'test_client_secret',
    redirect_uri: 'https://example.com/callback',
    is_active: true
  }
  
  const { error: insertError } = await serviceClient
    .from('user_google_drive_settings')
    .insert(testGoogleDriveSettings)
  
  if (insertError) {
    addResult('Insert test Google Drive settings', false, insertError.message)
    return
  }
  
  // Test with authenticated user
  const user1Client = createClient(supabaseUrl, supabaseAnonKey)
  await user1Client.auth.signInWithPassword({
    email: 'test1@example.com',
    password: 'testpassword123'
  })
  
  // Test 1: User can read own Google Drive settings
  const { data: ownSettings, error: ownSettingsError } = await user1Client
    .from('user_google_drive_settings')
    .select('*')
    .eq('user_id', user1Id)
  
  addResult(
    'User can read own Google Drive settings',
    !ownSettingsError && ownSettings?.length === 1,
    ownSettingsError?.message
  )
  
  // Test 2: User cannot read other user's Google Drive settings
  const { data: otherSettings, error: otherSettingsError } = await user1Client
    .from('user_google_drive_settings')
    .select('*')
    .eq('user_id', user2Id)
  
  addResult(
    'User cannot read other user\'s Google Drive settings',
    !otherSettingsError && otherSettings?.length === 0,
    otherSettingsError?.message
  )
  
  // Cleanup
  await serviceClient
    .from('user_google_drive_settings')
    .delete()
    .eq('user_id', user1Id)
}

async function main() {
  console.log('🔒 RLS Policy Verification Script')
  console.log('==================================')
  
  try {
    // Create test users
    const users = await createTestUsers()
    if (!users) {
      console.error('Failed to create test users')
      process.exit(1)
    }
    
    const { user1, user2 } = users
    
    // Run RLS tests
    await testUserApiKeysRLS(user1.id, user2.id)
    await testUserAiModelPreferencesRLS(user1.id, user2.id)
    await testUserZoteroSettingsRLS(user1.id, user2.id)
    await testUserGoogleDriveSettingsRLS(user1.id, user2.id)
    
    // Cleanup
    await cleanupTestUsers(user1.id, user2.id)
    
    // Summary
    console.log('\n📊 Test Results Summary')
    console.log('=======================')
    
    const passed = results.filter(r => r.passed).length
    const total = results.length
    
    console.log(`Total tests: ${total}`)
    console.log(`Passed: ${passed}`)
    console.log(`Failed: ${total - passed}`)
    
    if (passed === total) {
      console.log('\n🎉 All RLS policies are working correctly!')
      process.exit(0)
    } else {
      console.log('\n⚠️ Some RLS policies are not working correctly!')
      
      const failed = results.filter(r => !r.passed)
      console.log('\nFailed tests:')
      failed.forEach(result => {
        console.log(`- ${result.test}: ${result.error || 'Unknown error'}`)
      })
      
      process.exit(1)
    }
    
  } catch (error) {
    console.error('Script failed:', error)
    process.exit(1)
  }
}

// Run the script
main().catch(console.error)