function normalizeType(value, labels) {
  const type = value?.trim();
  // Legacy masters may store the display label, newer forms store the enum key.
  return Object.entries(labels).find(([key, label]) => [key.toLowerCase(), label.toLowerCase()].includes(type?.toLowerCase()))?.[0]
    || type || 'BELUM_DIISI';
}

// Pure aggregation: vendor IDs, facility IDs and sourcing profiles are different units.
export function summarizeActiveVendors(vendors, points = null, typeLabels = {}) {
  const active = new Map(vendors.filter((v) => v.is_active).map((v) => [v.id, v]));
  const profiles = new Map();
  if (points) for (const point of points) {
    if (!active.has(point.vendor_id)) continue;
    if (!profiles.has(point.vendor_id)) profiles.set(point.vendor_id, []);
    profiles.get(point.vendor_id).push(point);
  }
  const mapped = new Set(), complete = new Set(), verified = new Set(), facilities = new Set();
  const attention = [], distribution = new Map();
  for (const vendor of active.values()) {
    const type = normalizeType(vendor.vendor_type, typeLabels);
    distribution.set(type, (distribution.get(type) || 0) + 1);
    if (points === null) continue;
    const rows = profiles.get(vendor.id) || [];
    for (const row of rows) {
      // NULL is not the equator; zero is a valid coordinate.
      const hasGps = row.latitude !== null && row.latitude !== undefined && row.longitude !== null && row.longitude !== undefined
        && Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude));
      if (row.location_id && hasGps) { mapped.add(vendor.id); facilities.add(row.location_id); }
      if (row.is_complete) complete.add(vendor.id);
      if (row.is_complete && row.is_verified) verified.add(vendor.id);
    }
    if (!complete.has(vendor.id) || !verified.has(vendor.id)) {
      const reason = !mapped.has(vendor.id) ? 'GPS belum diisi' : !complete.has(vendor.id) ? 'Lokasi belum lengkap' : 'Perlu verifikasi';
      // Link to the profile requiring work, rather than an unrelated facility.
      const profile = rows.find((p) => p.is_complete && !p.is_verified) || rows[0];
      attention.push({ ...vendor, candidate_id: profile?.candidate_id || null, reason });
    }
  }
  attention.sort((a, b) => Number(mapped.has(a.id)) - Number(mapped.has(b.id)) || a.vendor_name.localeCompare(b.vendor_name, 'id'));
  return {
    active: active.size, mapped: points === null ? null : mapped.size,
    unmapped: points === null ? null : active.size - mapped.size,
    incomplete: points === null ? null : active.size - complete.size,
    verified: points === null ? null : verified.size,
    facilities: points === null ? null : facilities.size,
    coverage: points === null ? null : active.size ? Math.round(mapped.size / active.size * 100) : 0,
    attention, distribution: [...distribution].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))
  };
}
