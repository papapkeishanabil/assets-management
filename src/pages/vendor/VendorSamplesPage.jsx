import VendorSamplesPanel from '../../components/vendor/VendorSamplesPanel';
export default function VendorSamplesPage({ mode = 'samples' }) {
  return <div className="space-y-6 animate-fade-in min-w-0"><header><p className="text-xs text-primary-400 uppercase tracking-wide font-semibold">Manajemen Vendor</p><h1 className="text-2xl md:text-3xl font-semibold text-white mt-1">{mode === 'qc' ? 'Hasil QC Vendor' : 'Pengujian Sampel Vendor'}</h1><p className="text-sm text-ink-400 mt-1">Pemeriksaan oleh petugas QC, pencatatan oleh Sourcing. Setiap revisi dan koreksi memiliki jejak.</p></header><VendorSamplesPanel mode={mode} /></div>;
}
