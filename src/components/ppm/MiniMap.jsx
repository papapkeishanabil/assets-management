import { MINI_MAP, computeViewportRect, miniMapBox } from '../../lib/ppm-m31-helpers';

// ============================================================
// MiniMap — thumbnail floating di pojok kiri-bawah viewer (M3.2).
// - Menampilkan SELURUH gambar PO (source sama dengan viewer utama).
// - Rectangle outline biru/transparan = area yang sedang terlihat.
// - Klik thumbnail -> pindahkan pusat tampilan ke titik itu.
// - Ukuran & posisi dihitung pure (miniMapBox), rasio aspek dijaga.
// ============================================================
export default function MiniMap({ documentUrl, documentName, worldSize, viewerSize, transform, onNavigate }) {
  if (!worldSize.w || !worldSize.h || !viewerSize.w || !viewerSize.h) return null;
  const box = miniMapBox(worldSize.w, worldSize.h, viewerSize.w, viewerSize.h);
  if (!box) return null;
  const rect = computeViewportRect(transform, worldSize.w, worldSize.h, viewerSize.w, viewerSize.h);

  const handleClick = (e) => {
    if (!onNavigate) return;
    const b = e.currentTarget.getBoundingClientRect();
    if (!b.width || !b.height) return;
    const px = (e.clientX - b.left) / b.width;
    const py = (e.clientY - b.top) / b.height;
    onNavigate(px * worldSize.w, py * worldSize.h);
  };

  return (
    <div
      className="absolute z-40 overflow-hidden rounded-lg border border-white/20 bg-ink-900/40 backdrop-blur-2xl select-none"
      style={{
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        borderRadius: MINI_MAP.BORDER_RADIUS,
        boxShadow: '0 8px 24px -6px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08) inset, inset 0 1px 0 rgba(255,255,255,0.10)',
      }}
      title="Mini Map — klik untuk memindahkan tampilan"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="relative w-full h-full cursor-pointer" onClick={handleClick}>
        <img
          src={documentUrl}
          alt={documentName ? documentName + ' — thumbnail' : 'Thumbnail dokumen PO'}
          className="absolute inset-0 w-full h-full object-contain"
          draggable={false}
        />
        {rect && rect.w > 0 && rect.h > 0 && (
          <div
            className="absolute border-2 border-primary-500 bg-primary-500/15 pointer-events-none"
            style={{
              left: (rect.x / worldSize.w) * 100 + '%',
              top: (rect.y / worldSize.h) * 100 + '%',
              width: (rect.w / worldSize.w) * 100 + '%',
              height: (rect.h / worldSize.h) * 100 + '%',
            }}
          />
        )}
      </div>
    </div>
  );
}
