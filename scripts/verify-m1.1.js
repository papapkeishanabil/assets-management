import { SUPABASE_URL as url, SUPABASE_SERVICE_KEY as key , assertServiceKey} from './_ppm-env.js';
assertServiceKey();
import { createClient } from '@supabase/supabase-js';


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