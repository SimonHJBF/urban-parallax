/**
 * One-time script: set initial passwords for all Supabase auth users.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=eyJ... node scripts/set-passwords.js
 *
 * Get the service_role key from:
 *   Supabase Dashboard → Settings → API → service_role (secret)
 */

const SUPABASE_URL = 'https://qqoxqkpilcebvrscgvmn.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var.');
  console.error('Usage:  SUPABASE_SERVICE_KEY=eyJ... node scripts/set-passwords.js');
  process.exit(1);
}

const PASSWORD = '12345';

async function main() {
  // 1. List all users
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
    },
  });
  if (!res.ok) {
    console.error('Failed to list users:', res.status, await res.text());
    process.exit(1);
  }
  const { users } = await res.json();

  console.log(`Found ${users.length} user(s). Setting password "${PASSWORD}" for each…\n`);

  for (const u of users) {
    const up = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${u.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: PASSWORD }),
    });
    if (up.ok) {
      console.log(`  ✓ ${u.email} → password set to "${PASSWORD}"`);
    } else {
      console.error(`  ✗ ${u.email} → failed:`, await up.text());
    }
  }

  console.log('\nDone. Users can now sign in with their email + password "12345".');
  console.log('They can change it later via "Forgot password?" on the login page.');
}

main();
