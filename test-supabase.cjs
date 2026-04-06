const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://supabase01.i4vision.us';
const supabaseAnonKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc1NTA2NzUwMCwiZXhwIjo0OTEwNzQxMTAwLCJyb2xlIjoiYW5vbiJ9.zH718o3A3kfe14xc_PdXqtkanZNtyWwedRi1KVpDL_I';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data, error } = await supabase.from('house_rules').select('*').limit(1);
  console.log('House Rules:', data, error);

  const { data: d2, error: e2 } = await supabase.from('predefined_prompts').select('*').limit(1);
  console.log('Prompts:', d2, e2);
}

test();
