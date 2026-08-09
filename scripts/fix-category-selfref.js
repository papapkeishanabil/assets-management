import { SUPABASE_URL as SUPABASE_URL, SUPABASE_SERVICE_KEY as SERVICE_KEY , assertServiceKey} from './_ppm-env.js';
assertServiceKey();
// Fix: Update "Kendaraan Operasional" category to have parent_category_id = null
// because it currently references its own ID (self-reference)




async function fixCategory() {
  try {
    console.log('Fixing category self-reference...');
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/asset_categories?id=eq.e4467e52-dd5d-4cec-bb61-413f46da323b`, {
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ parent_category_id: null })
    });

    if (response.ok) {
      console.log('✅ Success! Category "Kendaraan Operasional" has been fixed.');
      console.log('Status:', response.status);
    } else {
      console.error('❌ Failed:', response.status, await response.text());
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixCategory();