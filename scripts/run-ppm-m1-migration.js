import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://uwlxkwyauxwewoexfgwi.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3bHhrd3lhdXh3ZXdvZXhmZ3dpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDYwODk4MiwiZXhwIjoyMTAwMTg0OTgyfQ.1Axuw7mObIbzeFiG7ZeKQCmzm-AVtyxaPbbAxfbeo3k';

const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '202608080003_ppm_m1_product_items.sql');

async function runMigration() {
  try {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('Migration file loaded, length:', sql.length, 'chars');

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql })
    });

    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', text);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

runMigration();