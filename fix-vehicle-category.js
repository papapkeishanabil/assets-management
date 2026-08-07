// Fix kategori kendaraan yang hilang
// Run: node fix-vehicle-category.js

const SUPABASE_URL = 'https://uwlxkwyauxwewoexfgwi.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3bHhrd3lhdXh3ZXdvZXhmZ3dpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDYwODk4MiwiZXhwIjoyMTAwMTg0OTgyfQ.1Axuw7mObIbzeFiG7ZeKQCmzm-AVtyxaPbbAxfbeo3k';

async function fixVehicleCategories() {
  try {
    console.log('🔍 Checking vehicle categories...\n');

    // 1. Get all categories
    const getCategoriesResponse = await fetch(`${SUPABASE_URL}/rest/v1/asset_categories?select=*`, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      }
    });

    const categories = await getCategoriesResponse.json();
    console.log(`Found ${categories.length} categories\n`);

    // 2. Find KEND category
    const kendCategory = categories.find(c => c.category_code === 'KEND');
    
    if (!kendCategory) {
      console.error('❌ KEND category not found!');
      return;
    }

    console.log('KEND Category:', {
      id: kendCategory.id,
      name: kendCategory.category_name,
      parent_id: kendCategory.parent_category_id,
      is_active: kendCategory.is_active
    });

    // 3. Check if KEND has self-reference
    if (kendCategory.parent_category_id === kendCategory.id) {
      console.log('\n⚠️  KEND has self-reference! Fixing...');
      
      const fixResponse = await fetch(`${SUPABASE_URL}/rest/v1/asset_categories?id=eq.${kendCategory.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ parent_category_id: null })
      });

      if (fixResponse.ok) {
        console.log('✅ Fixed KEND self-reference');
      } else {
        console.error('❌ Failed to fix KEND:', await fixResponse.text());
      }
    } else if (kendCategory.parent_category_id !== null) {
      console.log('\n⚠️  KEND has invalid parent! Fixing...');
      
      const fixResponse = await fetch(`${SUPABASE_URL}/rest/v1/asset_categories?id=eq.${kendCategory.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ parent_category_id: null })
      });

      if (fixResponse.ok) {
        console.log('✅ Fixed KEND parent reference');
      } else {
        console.error('❌ Failed to fix KEND:', await fixResponse.text());
      }
    } else {
      console.log('✅ KEND parent_category_id is NULL (correct)');
    }

    // 4. Check child categories
    console.log('\n🔍 Checking child categories...\n');
    const vehicleCategories = ['MBL', 'MTR', 'TRK', 'BUS', 'FLT', 'KDB'];
    
    for (const code of vehicleCategories) {
      const childCat = categories.find(c => c.category_code === code);
      
      if (!childCat) {
        console.log(`⚠️  ${code} not found - will be created by SQL script`);
        continue;
      }

      console.log(`${code}:`, {
        id: childCat.id,
        name: childCat.category_name,
        parent_id: childCat.parent_category_id,
        is_active: childCat.is_active
      });

      // Fix if parent is not KEND
      if (childCat.parent_category_id !== kendCategory.id) {
        console.log(`  ⚠️  Fixing parent reference...`);
        
        const fixResponse = await fetch(`${SUPABASE_URL}/rest/v1/asset_categories?id=eq.${childCat.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ parent_category_id: kendCategory.id, is_active: true })
        });

        if (fixResponse.ok) {
          console.log(`  ✅ Fixed ${code}`);
        } else {
          console.error(`  ❌ Failed to fix ${code}:`, await fixResponse.text());
        }
      } else {
        console.log(`  ✅ OK`);
      }
    }

    console.log('\n✅ Vehicle category fix complete!');
    console.log('\nNext steps:');
    console.log('1. Run fix-vehicle-category-complete.sql in Supabase SQL Editor');
    console.log('2. Refresh your browser');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixVehicleCategories();