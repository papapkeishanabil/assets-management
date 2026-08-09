// ============================================================
// PPM M2.1 - Spec display metadata (pure, no side-effects)
//
// Pusat satu-satunya untuk:
//  - display-label override (by spec_key)
//  - helper / hint text (by spec_key)
//  - review eligibility (isSpecificationReviewable) + value presence
//
// PRINSIP M2.1:
//  * spec_key & transactional snapshot TIDAK berubah — hanya label
//    tampilan yang lebih jelas/operasional bagi Marketing, Notulen,
//    Produksi, dan QC.
//  * USER TIDAK BOLEH DIPAKSA mengisi field yang tidak relevan / tidak
//    diketahui. Field kosong & opsional tidak menjadi blocking item
//   Technical Review dan tidak masuk ke denominator progress.
//  * Helper text kecil & terpusat (jangan disebar ke banyak component).
// ============================================================

// ---- Display-label override ------------------------------------------------
// Dipakai HANYA untuk tampilan (display). spec_key tetap apa adanya di DB
// sehingga transactional snapshot & test existing tidak berubah.
// Hanya entry yang perlu-keterangan operasional yang didefinisikan; sisanya
// fallback ke spec_label_snapshot / master spec_label.
export const SPEC_LABEL_OVERRIDE = {
  MODEL_KERAH: 'Jenis / Bentuk Kerah',
  TINGGI_KERAH: 'Tinggi Jadi Kerah',
  MODEL_SAKU: 'Jenis / Konstruksi Saku',
  LEBAR_SAKU: 'Lebar Jadi Saku',
  TINGGI_SAKU: 'Tinggi Jadi Saku',
  STITCH_BAH: 'Jenis Stitch Bah / Yoke',
  STITCH_ARMHOLE: 'Jenis Stitch Armhole',
  LEBAR_PLAKET: 'Lebar Jadi Plaket',
  TINGGI_MANSET: 'Tinggi Jadi Manset',
  // yang tidak tercantum di bawah (UKURAN_BORDIR, POSISI_BORDIR,
  // ARTWORK_BORDIR, UKURAN_VELCRO) memakai label master asli.
};

// ---- Helper / hint text (kecil, muted, muncul di dekat input) --------------
export const SPEC_HELPER_TEXT = {
  MODEL_KERAH: 'Pilih atau tuliskan bentuk/jenis kerah jika perlu dijelaskan secara tekstual.',
  TINGGI_KERAH: 'Masukkan tinggi kerah dalam kondisi jadi.',
  MODEL_SAKU: 'Jenis konstruksi saku sesuai desain atau keterangan PO.',
  LEBAR_SAKU: 'Lebar saku dalam kondisi jadi.',
  TINGGI_SAKU: 'Tinggi saku dalam kondisi jadi.',
  STITCH_BAH: 'Jenis atau jumlah jalur stitch pada bagian bah/yoke.',
  STITCH_ARMHOLE: 'Jenis atau jumlah jalur stitch pada bagian armhole.',
  LEBAR_PLAKET: 'Lebar plaket dalam kondisi jadi.',
  TINGGI_MANSET: 'Tinggi manset dalam kondisi jadi.',
};

// spec_key ada di master (spec_key) maupun transactional snapshot (spec_key_snapshot)
function specKeyOf(spec) {
  return spec?.spec_key ?? spec?.spec_key_snapshot ?? null;
}

/** Display label untuk sebuah spec row / definition. */
export function getSpecDisplayLabel(spec) {
  const key = specKeyOf(spec);
  if (key && SPEC_LABEL_OVERRIDE[key]) return SPEC_LABEL_OVERRIDE[key];
  return spec?.spec_label_snapshot ?? spec?.spec_label ?? '';
}

/** Helper text untuk sebuah spec (string kosong jika tidak ada). */
export function getSpecHelperText(spec) {
  const key = specKeyOf(spec);
  return key && SPEC_HELPER_TEXT[key] ? SPEC_HELPER_TEXT[key] : '';
}

/** Apakah spec punya *actual* nilai (untuk eligibility). */
export function hasSpecValue(spec) {
  if (!spec) return false;
  switch (spec.value_type) {
    case 'NUMBER':
      return spec.value_number != null && spec.value_number !== '';
    case 'BOOLEAN':
      return spec.value_boolean != null;
    case 'SELECT':
    case 'MULTI_SELECT':
      return spec.value_json != null && spec.value_json !== '';
    case 'TEXT':
    default:
      return spec.value_text != null && String(spec.value_text).trim() !== '';
  }
}

/** Required-flag (informatif). Catatan: transactional snapshot tidak
 * menyimpan is_required_default, jadi pada praktiknya required hanya aktif
 * bila secara eksplisit ditandai di sisi master/ui. */
function isSpecMarkedRequired(spec) {
  if (spec?.is_required) return true;
  if (spec?.definition?.is_required_default) return true;
  return false;
}

/**
 * Apakah sebuah spec harus muncul / dipertimbangkan dalam Technical Review?
 * Reviewable bila minimal salah satu:
 *  - mempunyai actual value
 *  - mempunyai notes / information
 *  - ditandai required
 *
 * Empty *optional* spec -> NOT reviewable -> tidak masuk denominator
 * progress dan tidak menjadi blocking item.
 */
export function isSpecificationReviewable(spec) {
  if (!spec) return false;
  if (hasSpecValue(spec)) return true;
  if (spec.notes && String(spec.notes).trim() !== '') return true;
  if (isSpecMarkedRequired(spec)) return true;
  return false;
}
