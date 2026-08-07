import { supabase } from './supabase';

const STORAGE_BUCKET = 'assets';
const PUBLIC_URL_PREFIX = `/storage/v1/object/public/${STORAGE_BUCKET}/`;

function extractStoragePath(publicUrl) {
  if (!publicUrl) return null;
  try {
    const url = new URL(publicUrl);
    const idx = url.pathname.indexOf(PUBLIC_URL_PREFIX);
    if (idx === -1) return null;
    return decodeURIComponent(url.pathname.slice(idx + PUBLIC_URL_PREFIX.length));
  } catch {
    return null;
  }
}

export async function permanentDeleteAsset(assetId) {
  const { data: photos, error: photoErr } = await supabase
    .from('asset_photos')
    .select('photo_url')
    .eq('asset_id', assetId);

  if (photoErr) throw photoErr;

  const paths = (photos || [])
    .map(p => extractStoragePath(p.photo_url))
    .filter(Boolean);

  if (paths.length > 0) {
    const { error: storageErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(paths);
    if (storageErr) console.warn('Storage cleanup gagal, tetap lanjut hapus record:', storageErr.message);
  }

  const { error: deleteErr } = await supabase
    .from('assets')
    .delete()
    .eq('id', assetId);

  if (deleteErr) throw deleteErr;
}
