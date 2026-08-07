// Fix: Update "Kendaraan Operasional" category to have parent_category_id = null
// because it currently references its own ID (self-reference)

const SUPABASE_URL = 'https://uwlxkwyauxwewoexfgwi.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3bHhrd3lhdXh3ZXdvZXhmZ3dpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDYwODk4MiwiZXhwIjoyMTAwMTg0OTgyfQ.1Axuw7mObIbzeFiG7ZeKQCmzm-AVtyxaPbbAxfbeo3k';

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