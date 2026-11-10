import { supabase } from './supabase';
import { VENDOR_TYPES } from './constants';
import { summarizeActiveVendors } from './vendor-dashboard-utils';

const backendPending = (error) => ['PGRST202', 'PGRST205', '42P01', '42883'].includes(error?.code);

async function allRows(client, table, columns, configure = (query) => query) {
  const rows = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await configure(client.from(table).select(columns)).range(start, start + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

// Read-only queries. Separate failures so a missing location backend never hides master totals.
export async function fetchVendorOverview({ canMap, canAssets }, client = supabase) {
  const [masters, locations, candidates] = await Promise.allSettled([
    allRows(client, 'vendors', 'id,vendor_code,vendor_name,vendor_type,city,is_active', (q) => q.eq('is_active', true).order('id')),
    canMap ? allRows(client, 'vendor_map_points', 'candidate_id,vendor_id,location_id,latitude,longitude,is_complete,is_verified',
      (q) => q.order('candidate_id').order('location_id', { nullsFirst: true })) : Promise.resolve(null),
    client.from('vendor_candidates').select('id', { count: 'exact', head: true }).is('vendor_id', null)
  ]);
  const mapStatus = !canMap ? 'restricted' : locations.status === 'fulfilled' ? 'ready'
    : backendPending(locations.reason) ? 'pending' : 'error';
  const summary = masters.status === 'fulfilled'
    ? summarizeActiveVendors(masters.value, mapStatus === 'ready' ? locations.value : null, VENDOR_TYPES) : null;
  let assetCount = null, assetError = '';
  if (canAssets && masters.status === 'fulfilled') {
    try {
      assetCount = 0;
      // Bounded URL size, disjoint batches and exact counts (not the API row limit).
      for (let start = 0; start < masters.value.length; start += 200) {
        const ids = masters.value.slice(start, start + 200).map((v) => v.id);
        const { error, count } = await client.from('assets').select('id', { count: 'exact', head: true }).in('vendor_id', ids);
        if (error) throw error;
        if (count === null) throw new Error('Jumlah aset tidak tersedia');
        assetCount += count;
      }
    } catch (error) { assetCount = null; assetError = error.message; }
  }
  return {
    summary, masterError: masters.status === 'rejected' ? masters.reason.message : '',
    mapStatus, mapError: mapStatus === 'error' ? locations.reason.message : '',
    candidates: candidates.status === 'fulfilled' && !candidates.value.error ? candidates.value.count : null,
    candidateError: candidates.status === 'rejected' ? candidates.reason.message : candidates.value.error?.message || '',
    assetCount, assetError
  };
}
