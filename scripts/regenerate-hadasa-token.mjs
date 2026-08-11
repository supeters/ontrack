#!/usr/bin/env node

/**
 * Regenerate Hadasa's Moodle Token
 * Decrypts stored password and gets new API token
 *
 * Usage:
 *   node scripts/regenerate-hadasa-token.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jfdrzjueqfxvozwcsyhm.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmZHJ6anVlcWZ4dm96d2NzeWhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDc4OTA4MCwiZXhwIjoyMDcwMzY1MDgwfQ.zJEJed2-6VPNjk2IM4xFZVU99lGdEeWfPZ5f0QVHmyc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * XOR decryption matching family-dashboard encryption.js
 */
function decryptPassword(encryptedPassword) {
  const ENCRYPTION_KEY = 'family-dashboard-2025';

  try {
    // Base64 decode
    const encrypted = atob(encryptedPassword);

    let decrypted = '';
    for (let i = 0; i < encrypted.length; i++) {
      const charCode = encrypted.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
      decrypted += String.fromCharCode(charCode);
    }

    return decrypted;
  } catch (error) {
    console.error('Error decrypting password:', error);
    return null;
  }
}

/**
 * Get new Moodle API token
 */
async function getMoodleToken(url, username, password) {
  console.log('🔐 Requesting new Moodle token...');

  const response = await fetch(`${url}/login/token.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      username: username,
      password: password,
      service: 'moodle_mobile_app'
    })
  });

  const result = await response.text();

  if (result.includes('"token"')) {
    const tokenData = JSON.parse(result);
    console.log('✅ New token obtained successfully');
    return tokenData.token;
  } else {
    console.error('❌ Failed to get token:', result);
    throw new Error('Failed to get Moodle token - check username/password');
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🚀 Regenerating Hadasa\'s Moodle Token\n');

    // Step 1: Get LMS account
    console.log('🔍 Looking up Hadasa\'s LMS account...');
    const { data: lmsAccount, error } = await supabase
      .from('lms_accounts')
      .select('*')
      .eq('kid_id', 2)
      .eq('lms_type', 'moodle')
      .single();

    if (error) {
      console.error('❌ Error finding LMS account:', error);
      throw error;
    }

    console.log(`✅ Found LMS account (ID: ${lmsAccount.id})`);
    console.log(`   URL: ${lmsAccount.lms_url}`);
    console.log(`   Username: ${lmsAccount.lms_user_name}`);

    // Step 2: Decrypt password
    console.log('\n🔓 Decrypting stored password...');
    const password = decryptPassword(lmsAccount.encrypted_password);

    if (!password) {
      throw new Error('Failed to decrypt password');
    }

    console.log('✅ Password decrypted successfully');

    // Step 3: Get new token
    const newToken = await getMoodleToken(
      lmsAccount.lms_url,
      lmsAccount.lms_user_name,
      password
    );

    // Step 4: Update database
    console.log('\n💾 Updating database with new token...');
    const { error: updateError } = await supabase
      .from('lms_accounts')
      .update({
        api_token: newToken,
        last_sync: new Date().toISOString()
      })
      .eq('id', lmsAccount.id);

    if (updateError) {
      console.error('❌ Error updating database:', updateError);
      throw updateError;
    }

    console.log('✅ Database updated successfully');

    console.log('\n✅ Token regeneration complete!\n');
    console.log('You can now run: node scripts/test-hadasa-moodle.mjs\n');

  } catch (error) {
    console.error('\n❌ Token regeneration failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
