const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const bucket = 'vendor-product-references';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const only = (value, fields) => object(value) && Object.keys(value).every(key => fields.includes(key));
const stable = value => Array.isArray(value) ? value.map(stable) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const same = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
const hex = buffer => [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
const hash = async bytes => hex(await crypto.subtle.digest('SHA-256', bytes));
const string = (value, max, required = true) => {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw fail('Data sampel/produk tidak valid.');
  return value.trim() || null;
};
async function boundedBody(message, limit) {
  if (Number(message.headers.get('content-length')) > limit) throw fail('Data layanan terlalu besar.', 413);
  const reader = message.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts = []; let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      length += value.length;
      if (length > limit) { await reader.cancel(); throw fail('Data layanan terlalu besar.', 413); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return bytes;
}
export function normalizeOfissioProduct(product) {
  if (!object(product) || !/^wc-\d+$/.test(product.id || '')) return null; // Reject mock/demo products.
  try {
    const id = string(product.id, 80), sku = string(product.sku, 100), name = string(product.name, 300);
    const slug = string(product.slug, 200);
    if (!/^[a-z0-9-]+$/.test(slug)) return null;
    const image = new URL(product.mainImage);
    if (image.origin !== 'https://woo.ofissio.com' || image.username || image.password || image.search || image.hash
      || !/^\/wp-content\/uploads\/[A-Za-z0-9_./%~-]+\.(webp|png|jpe?g)$/.test(image.pathname)) return null;
    return { id, sku, name, material: string(product.material || '', 500, false) || '', image_url: image.href, product_url: `https://ofissio.com/product/${slug}` };
  } catch { return null; }
}
function samplePayload(raw) {
  const fields = ['candidate_id', 'sample_type', 'brief', 'material_source', 'quantity', 'unit', 'cost', 'internal_pic_id', 'assigned_at', 'target_date', 'received_at', 'notes', 'revision_note', 'related_sample_id'];
  if (!only(raw, fields) || !uuid.test(raw.candidate_id || '')) throw fail('Data sampel tidak valid.');
  const data = {};
  for (const [key, max, required] of [['sample_type', 40, true], ['brief', 10000, true], ['material_source', 30, true], ['unit', 50, true], ['notes', 10000, false], ['revision_note', 10000, false]]) data[key] = string(raw[key], max, required);
  if (data.brief.length < 5 || !['JAHIT_PRODUK', 'BORDIR', 'SWATCH_KAIN', 'UJI_KAIN', 'PRINTING', 'CUTTING', 'FINISHING', 'AKSESORIS', 'LAINNYA'].includes(data.sample_type) || !['HARMAS', 'VENDOR', 'GABUNGAN', 'TIDAK_RELEVAN'].includes(data.material_source)) throw fail('Jenis, bahan atau brief sampel tidak valid.');
  if (!['number', 'string'].includes(typeof raw.quantity) || (raw.cost != null && !['number', 'string'].includes(typeof raw.cost))) throw fail('Jumlah atau biaya sampel tidak valid.');
  data.quantity = Number(raw.quantity); data.cost = raw.cost == null || raw.cost === '' ? null : Number(raw.cost);
  if (!Number.isFinite(data.quantity) || data.quantity <= 0 || (data.cost !== null && (!Number.isFinite(data.cost) || data.cost < 0))) throw fail('Jumlah atau biaya sampel tidak valid.');
  for (const key of ['internal_pic_id', 'related_sample_id']) { data[key] = raw[key] || null; if (data[key] && !uuid.test(data[key])) throw fail('PIC/sampel terkait tidak valid.'); }
  for (const key of ['assigned_at', 'received_at']) { data[key] = raw[key] || null; if (data[key] && (typeof data[key] !== 'string' || data[key].length > 40 || !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(data[key]) || !Number.isFinite(Date.parse(data[key])))) throw fail('Waktu sampel tidak valid.'); }
  data.target_date = raw.target_date || null;
  if (data.target_date && (typeof data.target_date !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(data.target_date) || !Number.isFinite(Date.parse(data.target_date)) || new Date(data.target_date).toISOString().slice(0, 10) !== data.target_date)) throw fail('Tanggal target tidak valid.');
  return { candidate_id: raw.candidate_id, ...data };
}
function imageType(bytes) {
  const ascii = (start, end) => new TextDecoder().decode(bytes.slice(start, end));
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return ['image/webp', 'webp'];
  if (bytes.length >= 8 && bytes.slice(0, 8).every((v, i) => v === [137, 80, 78, 71, 13, 10, 26, 10][i])) return ['image/png', 'png'];
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return ['image/jpeg', 'jpg'];
  throw fail('Foto katalog bukan JPG, PNG atau WebP yang valid.', 502);
}
// The only upstreams are fixed public catalog/image hosts. Browser input never supplies a fetch URL.
export function createOfissioCatalogHandler({ createClient, env, fetchImpl = fetch, now = () => Date.now(), log = record => console.info(JSON.stringify(record)) }) {
  const limits = new Map();
  const rate = (id, action) => {
    const key = `${id}:${action}`, time = now(), cap = action === 'search' ? 30 : 6;
    if (limits.size > 2000) for (const [k, v] of limits) if (v.until <= time) limits.delete(k);
    const value = limits.get(key);
    if (value?.until > time && value.count >= cap) throw fail('Terlalu banyak permintaan. Tunggu satu menit.', 429);
    limits.set(key, value?.until > time ? { ...value, count: value.count + 1 } : { count: 1, until: time + 60000 });
  };
  async function search(query) {
    let response;
    try { response = await fetchImpl(`https://ofissio.com/api/catalog/search?q=${encodeURIComponent(query)}`, { redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } }); }
    catch { throw fail('Katalog Ofissio belum dapat dihubungi. Coba lagi.', 502); }
    if (!response.ok) throw fail('Katalog Ofissio sedang tidak tersedia. Coba lagi.', response.status === 429 ? 429 : 502);
    let data; try { data = JSON.parse(new TextDecoder().decode(await boundedBody(response, 1048576))); } catch (error) { if (error.status) throw error; throw fail('Respons katalog Ofissio tidak valid.', 502); }
    if (data?.ok !== true || !Array.isArray(data.result?.products)) throw fail('Respons katalog Ofissio tidak valid.', 502);
    return data.result.products.slice(0, 12).map(normalizeOfissioProduct).filter(Boolean);
  }
  return async request => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers });
    if (request.method !== 'POST') return json({ error: 'Metode tidak diizinkan.' }, 405);
    let actor;
    try {
      const url = env('SUPABASE_URL'), anon = env('SUPABASE_ANON_KEY'), secret = env('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !anon || !secret) throw fail('Integrasi katalog belum dikonfigurasi.', 503);
      const authorization = request.headers.get('Authorization');
      if (!/^Bearer\s+\S+$/i.test(authorization || '')) throw fail('Silakan masuk kembali.', 401);
      const options = { auth: { persistSession: false, autoRefreshToken: false } };
      const caller = createClient(url, anon, { ...options, global: { headers: { Authorization: authorization } } });
      const admin = createClient(url, secret, options);
      const identity = await caller.auth.getUser();
      if (identity.error || !identity.data?.user) throw fail('Sesi tidak valid. Silakan masuk kembali.', 401);
      const authId = identity.data.user.id;
      const profile = await admin.from('user_profiles').select('id,role_id,account_status').eq('auth_user_id', authId).single();
      if (profile.error || profile.data?.account_status !== 'ACTIVE') throw fail('Akses katalog ditolak.', 403);
      actor = profile.data;
      const role = await admin.from('roles').select('role_name').eq('id', actor.role_id).single();
      const roleName = role.data?.role_name;
      if (role.error || !['sourcing', 'hrd', 'super_admin', 'direksi'].includes(roleName)) throw fail('Akses katalog ditolak.', 403);
      if (roleName !== 'super_admin') {
        const permission = await admin.from('role_permissions').select('can_access').eq('role_id', actor.role_id).eq('module_key', 'vendor_samples').maybeSingle();
        if (permission.error || !permission.data?.can_access) throw fail('Akses modul sampel belum diaktifkan.', 403);
      }
      let payload; try { payload = JSON.parse(new TextDecoder().decode(await boundedBody(request, 131072))); } catch (error) { if (error.status) throw error; throw fail('Data permintaan tidak valid.'); }
      if (!only(payload, ['action', 'query', 'product_id', 'sku', 'sample', 'request_id']) || !['search', 'create_sample'].includes(payload.action)) throw fail('Tindakan tidak valid.');
      if (payload.action === 'search') {
        if (!only(payload, ['action', 'query'])) throw fail('Data pencarian tidak valid.');
        const query = string(payload.query, 160); if (query.length < 2) throw fail('Ketik minimal dua karakter.');
        rate(actor.id, 'search'); return json({ products: await search(query) });
      }
      if (!['sourcing', 'hrd', 'super_admin'].includes(roleName)) throw fail('Hanya petugas berwenang dapat membuat sampel.', 403);
      if (!only(payload, ['action', 'product_id', 'sku', 'sample', 'request_id']) || !uuid.test(payload.request_id || '') || !/^wc-\d+$/.test(payload.product_id || '')) throw fail('Permintaan sampel tidak valid.');
      const sample = samplePayload(payload.sample), sku = string(payload.sku, 100);
      const requestValue = { sample, product_id: payload.product_id, sku };
      const previous = await admin.from('vendor_sample_product_references').select('sample_id,captured_by,request_payload').eq('sample_id', payload.request_id).maybeSingle();
      if (previous.error) throw fail('Penyimpanan acuan katalog belum tersedia. Hubungi administrator.', 503);
      if (previous.data) {
        if (previous.data.captured_by !== actor.id || !same(previous.data.request_payload, requestValue)) throw fail('Permintaan sudah tersimpan dengan data berbeda. Muat ulang daftar sampel.', 409);
        const saved = await admin.from('vendor_samples').select('*').eq('id', previous.data.sample_id).single();
        if (saved.error) throw fail('Sampel tersimpan belum dapat dimuat. Muat ulang daftar.', 503);
        return json({ sample: saved.data, reused: true });
      }
      rate(actor.id, 'create_sample');
      const candidate = await admin.from('vendor_candidates').select('id,archived_at').eq('id', sample.candidate_id).maybeSingle();
      if (candidate.error || !candidate.data || candidate.data.archived_at) throw fail('Kandidat tidak tersedia/diarsipkan.', 403);
      const products = await search(sku), exact = products.filter(p => p.id === payload.product_id && p.sku === sku);
      if (exact.length !== 1) throw fail('Produk acuan sudah berubah/tidak tersedia. Cari dan pilih kembali.', 409);
      const product = exact[0];
      let imageResponse;
      try { imageResponse = await fetchImpl(product.image_url, { redirect: 'error', signal: AbortSignal.timeout(15000) }); }
      catch { throw fail('Foto produk belum dapat disalin. Coba lagi.', 502); }
      if (!imageResponse.ok) throw fail('Foto produk tidak tersedia.', 502);
      const bytes = await boundedBody(imageResponse, 5242880), [mime, extension] = imageType(bytes);
      if (imageResponse.headers.get('content-type')?.split(';')[0].trim() !== mime) throw fail('Tipe foto katalog tidak cocok.', 502);
      const sha = await hash(bytes), path = `${sample.candidate_id}/${payload.request_id}/${sha}.${extension}`;
      const stored = await admin.storage.from(bucket).upload(path, bytes, { contentType: mime, upsert: false });
      if (stored.error) {
        // A simultaneous retry may have uploaded the same immutable object. Verify bytes before reuse.
        if (!['409', 'Duplicate'].includes(String(stored.error.statusCode ?? stored.error.error))) throw fail('Foto acuan belum dapat disimpan. Coba lagi.', 503);
        const old = await admin.storage.from(bucket).download(path);
        if (old.error || await hash(await old.data.arrayBuffer()) !== sha) throw fail('Salinan foto bentrok. Muat ulang daftar sampel.', 409);
      }
      const saved = await admin.rpc('vendor_create_ofissio_sample', { p_actor_auth_id: authId, p_sample: sample, p_request_id: payload.request_id,
        p_reference: { id: product.id, sku: product.sku, name: product.name, material: product.material, product_url: product.product_url, image_url: product.image_url, image_path: path, image_sha256: sha, image_mime: mime, image_size: bytes.length } });
      if (saved.error) {
        // Never delete after an ambiguous RPC outcome: COMMIT may already have succeeded.
        if (saved.error.code === '40001' || saved.error.code === '23505') throw fail('Permintaan berbenturan. Muat ulang daftar atau coba simpan kembali.', 409);
        if (saved.error.code === '42501') throw fail('Akses/kandidat berubah. Muat ulang sebelum menyimpan.', 403);
        if (['P0001', '23503', '23514', '22P02', '22007'].includes(saved.error.code)) throw fail('Periksa PIC, tanggal penugasan/target, serta hubungan sampel. Sampel belum dibuat.', 400);
        throw fail('Sampel belum dapat dipastikan tersimpan. Muat ulang daftar atau coba simpan kembali.', 503);
      }
      log({ event: 'vendor_ofissio_sample_created', actor_profile_id: actor.id, sample_id: payload.request_id, image_sha256: sha });
      return json({ sample: saved.data, reused: false });
    } catch (error) {
      if (!error.status) log({ event: 'vendor_ofissio_catalog_error', actor_profile_id: actor?.id || null });
      return json({ error: error.status ? error.message : 'Integrasi katalog belum dapat memproses permintaan.' }, error.status || 500);
    }
  };
}
