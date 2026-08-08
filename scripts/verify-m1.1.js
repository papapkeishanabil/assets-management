import { createClient } from '@supabase/supabase-js';
const url = 'https://uwlxkwyauxwewoexfgwi.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3bHhrd3lhdXh3ZXdvZXhmZ3dpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDYwODk4MiwiZXhwIjoyMTAwMTg0OTgyfQ.1Axuw7mObIbzeFiG7ZeKQCmzm-AVtyxaPbbAxfbeo3k';
const supabase = createClient(url, key);
const { data, error } = await supabase.from('product_type_default_components').select('product_type_id,product_types(code)');
const map = {};
for (const row of data || []) {
  const code = row.product_types?.code;
  map[code] = (map[code] || 0) + 1;
}
console.log('SEED_COUNTS:', JSON.stringify(map));
console.log('KEMEJA_OK:', (map['KEMEJA'] || 0) === 8);
console.log('CELANA_OK:', (map['CELANA'] || 0) === 7);