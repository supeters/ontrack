import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

/**
 * XOR decryption matching family-dashboard encryption.js
 */
function decryptPassword(encryptedPassword: string): string | null {
  const ENCRYPTION_KEY = 'family-dashboard-2025';

  try {
    // Base64 decode
    const encrypted = Buffer.from(encryptedPassword, 'base64').toString('binary');

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
async function getMoodleToken(url: string, username: string, password: string): Promise<string> {
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

// GET /api/moodle/test-connection?accountId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });
    }

    const supabase = await getServerClient();

    // Get account
    const { data: account, error } = await supabase
      .from('lms_accounts')
      .select('*')
      .eq('id', parseInt(accountId))
      .single();

    if (error) throw error;

    // Decrypt password
    const password = decryptPassword(account.encrypted_password);
    if (!password) {
      throw new Error('Failed to decrypt password');
    }

    // Get new token from Moodle
    const newToken = await getMoodleToken(
      account.lms_url,
      account.lms_user_name,
      password
    );

    // Update account with new token
    const { error: updateError } = await supabase
      .from('lms_accounts')
      .update({
        api_token: newToken,
        is_active: true,
        last_sync: new Date().toISOString()
      })
      .eq('id', parseInt(accountId));

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: 'Connection successful and token refreshed!'
    });
  } catch (error: any) {
    console.error('Error testing Moodle connection:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || String(error)
      },
      { status: 500 }
    );
  }
}
