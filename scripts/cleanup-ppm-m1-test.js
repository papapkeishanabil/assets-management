import { SUPABASE_URL as url, SUPABASE_SERVICE_KEY as key , assertServiceKey} from './_ppm-env.js';
assertServiceKey();
// Cleanup orphaned PPM M1 test data
// SAFE: only deletes items with the __TEST_M1__ prefix marker,
// so real user data is NEVER affected.


const h = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };

async function run() {
  // Find orphaned test items (only the __TEST_M1__ marker prefix)
  const res = await fetch(url + '/rest/v1/ppm_po_items?select=id,item_name&item_name=like.*__TEST_M1__*', { headers: h });
  const items = await res.json();
  console.log('Orphaned test items found:', items.length);
  for (const it of items) {
    await fetch(url + '/rest/v1/ppm_po_items?id=eq.' + it.id, { method: 'DELETE', headers: h });
    console.log('Deleted:', it.item_name, it.id);
  }
  console.log('Cleanup complete. (Real user data is never touched.)');
}

run().catch(e => { console.error(e); process.exit(1); });