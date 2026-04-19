import { createClient } from '@supabase/supabase-js';
import { formatPhoneE164, phoneToEmail } from '../utils/phone.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdmin(phone: string, pass: string, name: string) {
  const formattedPhone = formatPhoneE164(phone);
  const shadowEmail = phoneToEmail(phone);
  
  console.log(`Creating Admin user: ${formattedPhone} (${shadowEmail})`);
  
  const { data, error } = await supabase.auth.admin.createUser({
    email: shadowEmail,
    password: pass,
    email_confirm: true,
    user_metadata: {
      display_name: name,
      role: 'admin',
      phone_number: formattedPhone
    }
  });

  if (error) {
    console.error('Error creating user:', error.message);
    return;
  }

  console.log('Admin user created successfully!');
  console.log('User ID:', data.user.id);
  console.log('Role:', data.user.user_metadata.role);
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: npx tsx src/scripts/create-admin.ts <phone> <password> [display_name]');
  process.exit(0);
}

const [phone, password, displayName = 'Admin'] = args;
createAdmin(phone, password, displayName);
