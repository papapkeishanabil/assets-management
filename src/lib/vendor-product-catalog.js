import { supabase } from './supabase';

export async function invokeProductCatalog(payload) {
  const { data, error } = await supabase.functions.invoke('vendor-ofissio-catalog', { body: payload });
  if (error) {
    let message;
    try { message = (await error.context?.clone().json())?.error; } catch { /* Network/undeployed function. */ }
    throw new Error(message || 'Integrasi katalog Ofissio belum tersedia. Coba lagi atau hubungi administrator.');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
export async function searchOfissioProducts(query) {
  const data = await invokeProductCatalog({ action: 'search', query });
  if (!Array.isArray(data?.products)) throw new Error('Respons katalog tidak valid. Coba lagi.');
  return data.products;
}
export async function createOfissioSample(sample, product, requestId) {
  const { product_code: _code, ...payload } = sample;
  const data = await invokeProductCatalog({ action: 'create_sample', product_id: product.id, sku: product.sku, sample: payload, request_id: requestId });
  if (!data?.sample?.id) throw new Error('Status simpan belum pasti. Muat ulang daftar sampel sebelum membuat ulang.');
  return data.sample;
}
export async function fetchSampleProductReference(sampleId) {
  const { data, error } = await supabase.from('vendor_sample_product_references')
    .select('sample_id,source,product_id,product_code,product_name,material,product_url,image_path,image_sha256,captured_at,captured_by')
    .eq('sample_id', sampleId).maybeSingle();
  // Existing/manual samples remain usable before the additive migration is installed.
  if (error && ['PGRST205', '42P01'].includes(error.code)) return null;
  if (error) throw error;
  return data;
}
export async function signedProductReference(path) {
  const { data, error } = await supabase.storage.from('vendor-product-references').createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}
