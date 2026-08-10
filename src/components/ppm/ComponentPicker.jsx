import { useState, useEffect } from 'react';
import { Search, Plus, Check, Sparkles, CornerUpRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchComponentDefinitions } from '../../lib/ppm-m1-helpers';
import { componentDisplayLabel } from '../../lib/ppm-m3-helpers';
import {
  addComponentFromLibrary,
  createCustomComponentForAnnotation,
  searchComponentLibrary,
  libraryComponentsNotUsed,
} from '../../lib/ppm-m31-helpers';

// ============================================================
// ComponentPicker — searchable component picker untuk Add Pin (A).
//
// Struktur:
//   KOMPONEN PRODUK INI  — komponen yang sudah ada di Product Item
//   TAMBAHKAN KOMPONEN   — cari Component Library; item yang belum
//                          dipakai item: "Belum digunakan pada produk ini"
//                          + [+ Tambahkan ke Produk & Gunakan]
//   + Buat Komponen Custom — nama + lokasi (tidak promote ke master)
//
// Alur tambah komponen TIDAK menutup workflow Add Pin. Komponen yang baru
// dibuat langsung di-select sebagai komponen pin.
// ============================================================
export default function ComponentPicker({
  components,
  itemId,
  value,
  onChange,
  canManage,
  profile,
  onComponentAdded,
}) {
  const [definitions, setDefinitions] = useState([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [addingId, setAddingId] = useState(null);
  const [savingCustom, setSavingCustom] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchComponentDefinitions()
      .then((defs) => { if (!cancelled) setDefinitions(defs || []); })
      .catch(() => { if (!cancelled) setDefinitions([]); });
    return () => { cancelled = true; };
  }, []);

  const item = { id: itemId, components: components || [] };
  const notUsed = libraryComponentsNotUsed(definitions, item);
  const searchResults = searchComponentLibrary(notUsed, librarySearch);

  // Deteksi "sudah digunakan" utama by component_definition_id (precise join).
  // Name dipertahankan sebagai fallback agar konsisten dengan helper
  // isLibraryComponentUsedByItem (id OR name) yang diverifikasi oleh test.
  const usedByDefId = new Set(
    (components || []).map((c) => c.component_definition_id).filter(Boolean)
  );
  const usedByName = new Set(
    (components || []).map((c) => String(c.component_name_snapshot || '').toLowerCase())
  );
  const filteredItemComps = (components || []).filter((c) =>
    String(c.component_name_snapshot || '').toLowerCase().includes(String(itemSearch || '').trim().toLowerCase())
  );

  const handleAddLibrary = async (def) => {
    if (!canManage) return;
    setAddingId(def.id);
    try {
      const created = await addComponentFromLibrary({
        itemId,
        definition: def,
        locationLabel: null,
        createdBy: profile ? profile.id : null,
      });
      toast.success('Komponen ditambahkan ke produk ini');
      onChange(created.id);
      if (onComponentAdded) onComponentAdded(created);
    } catch (err) {
      console.error(err);
      toast.error('Gagal menambahkan komponen');
    } finally {
      setAddingId(null);
    }
  };

  const handleCreateCustom = async () => {
    if (!canManage) return;
    if (!String(customName || '').trim()) { toast.error('Nama komponen wajib diisi'); return; }
    setSavingCustom(true);
    try {
      const created = await createCustomComponentForAnnotation({
        itemId,
        name: customName,
        locationLabel: customLocation || null,
        createdBy: profile ? profile.id : null,
      });
      toast.success('Komponen custom dibuat');
      setCustomName('');
      setCustomLocation('');
      setShowCustom(false);
      onChange(created.id);
      if (onComponentAdded) onComponentAdded(created);
    } catch (err) {
      console.error(err);
      toast.error('Gagal membuat komponen custom');
    } finally {
      setSavingCustom(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* ============ KOMPONEN PRODUK INI ============ */}
      <div>
        <p className="text-[11px] font-semibold text-ink-300 uppercase tracking-wide mb-1.5">
          Komponen Produk Ini
        </p>
        {filteredItemComps.length === 0 ? (
          <p className="text-xs text-ink-500 py-1">Belum ada komponen pada produk ini.</p>
        ) : (
          <>
            <div className="relative mb-1.5">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" />
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="input pl-8 py-1.5 text-xs"
                placeholder="Cari di produk ini..."
              />
            </div>
            <div className="space-y-1 max-h-44 overflow-y-auto">
              {filteredItemComps.map((c) => {
                const active = c.id === value;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onChange(c.id)}
                    className={
                      'w-full text-left px-3 py-2 rounded-lg border text-sm flex items-center justify-between gap-2 transition-colors ' +
                      (active
                        ? 'border-primary-500/50 bg-primary-500/10 text-white'
                        : 'border-white/10 bg-black/20 text-ink-200 hover:border-white/25')
                    }
                  >
                    <span className="truncate min-w-0">
                      {componentDisplayLabel(c)}
                      {c.is_custom && <span className="badge badge-yellow text-[10px] px-1.5 py-0.5 ml-1.5">Custom</span>}
                    </span>
                    {active && <Check size={14} className="text-primary-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ============ TAMBAHKAN KOMPONEN (LIBRARY) ============ */}
      {canManage && (
        <div className="border-t border-white/10 pt-3">
          <p className="text-[11px] font-semibold text-ink-300 uppercase tracking-wide mb-1.5">
            Tambahkan Komponen
          </p>
          <div className="relative mb-1.5">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" />
            <input
              type="text"
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              className="input pl-8 py-1.5 text-xs"
              placeholder="Cari Component Library..."
            />
          </div>
          {searchResults.length === 0 ? (
            <p className="text-xs text-ink-500 py-1">
              {librarySearch.trim() ? 'Tidak ditemukan di library. Gunakan komponen custom di bawah.' : 'Semua komponen library sudah terpasang.'}
            </p>
          ) : (
            <div className="space-y-1 max-h-44 overflow-y-auto">
              {searchResults.map((def) => {
                const inItem = usedByDefId.has(def.id) || usedByName.has(String(def.name || '').toLowerCase());
                return (
                  <div
                    key={def.id}
                    className={'rounded-lg border px-3 py-2 flex items-center justify-between gap-2 ' + (inItem ? 'border-white/5 opacity-60' : 'border-white/10 bg-black/20')}
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{def.name}</p>
                      {inItem ? (
                        <p className="text-[11px] text-ink-400">Sudah digunakan pada produk ini</p>
                      ) : (
                        <p className="text-[11px] text-ink-400">Belum digunakan pada produk ini</p>
                      )}
                    </div>
                    {!inItem && (
                      <button
                        type="button"
                        onClick={() => handleAddLibrary(def)}
                        disabled={addingId === def.id}
                        className="btn-secondary btn-sm flex-shrink-0"
                      >
                        {addingId === def.id ? 'Menambah...' : (
                          <><Plus size={12} /> Tambahkan ke Produk &amp; Gunakan</>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Custom component */}
          <div className="mt-2">
            {showCustom ? (
              <div className="space-y-2 rounded-lg border border-primary-500/30 bg-primary-500/[0.06] p-3">
                <p className="text-xs font-medium text-white flex items-center gap-1">
                  <Sparkles size={13} className="text-primary-400" /> Buat Komponen Custom
                </p>
                <div>
                  <label className="block text-[11px] text-ink-400 mb-1">Nama Komponen *</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="input py-1.5 text-sm"
                    placeholder="Contoh: Loop HT"
                    disabled={savingCustom}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-ink-400 mb-1">Lokasi (opsional)</label>
                  <input
                    type="text"
                    value={customLocation}
                    onChange={(e) => setCustomLocation(e.target.value)}
                    className="input py-1.5 text-sm"
                    placeholder="Contoh: Dada Kanan"
                    disabled={savingCustom}
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCustom(false)}
                    className="btn btn-ghost btn-sm"
                    disabled={savingCustom}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateCustom}
                    disabled={savingCustom}
                    className="btn-primary btn-sm"
                  >
                    <CornerUpRight size={12} /> {savingCustom ? 'Membuat...' : 'Buat & Gunakan'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCustom(true)}
                className="text-xs font-medium text-primary-400 hover:text-primary-300 inline-flex items-center gap-1"
              >
                <Sparkles size={12} /> + Buat Komponen Custom
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
