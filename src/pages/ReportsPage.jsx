import { useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { FileText, Download, Calendar } from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/constants';

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const reports = [
    { id: 'all-assets', title: 'Daftar Seluruh Aset', desc: 'Seluruh data aset perusahaan' },
    { id: 'by-category', title: 'Aset Berdasarkan Kategori', desc: 'Rekapitulasi aset per kategori' },
    { id: 'by-location', title: 'Aset Berdasarkan Lokasi', desc: 'Rekapitulasi aset per lokasi' },
    { id: 'by-condition', title: 'Aset Berdasarkan Kondisi', desc: 'Rekapitulasi aset per kondisi' },
    { id: 'maintenance-schedule', title: 'Jadwal Pemeliharaan', desc: 'Jadwal pemeliharaan aset' },
    { id: 'maintenance-cost', title: 'Biaya Pemeliharaan', desc: 'Rekapitulasi biaya pemeliharaan' },
    { id: 'overdue-list', title: 'Pemeliharaan Terlambat', desc: 'Daftar pemeliharaan yang terlambat' },
    { id: 'damage-report', title: 'Laporan Kerusakan', desc: 'Rekapitulasi kerusakan aset' }
  ];

  const generateReport = async (reportId) => {
    setLoading(true);
    try {
      let data, filename, csv;

      switch (reportId) {
        case 'all-assets': {
          const { data: assets } = await supabase.from('assets').select('*, categories:category_id (category_name), locations:location_id (location_name)').eq('is_active', true);
          data = assets;
          filename = 'daftar_seluruh_aset';
          csv = [['Kode', 'Nama Aset', 'Kategori', 'Merek', 'Lokasi', 'Kondisi', 'Status', 'Harga']];
          data.forEach(a => csv.push([a.asset_code, a.asset_name, a.categories?.category_name || '', a.brand || '', a.locations?.location_name || '', a.asset_condition, a.asset_status, a.purchase_price || 0]));
          break;
        }
        case 'maintenance-cost': {
          let query = supabase.from('maintenance_records').select('*, assets:asset_id (asset_name)').order('maintenance_date', { ascending: false });
          if (dateFrom) query = query.gte('maintenance_date', dateFrom);
          if (dateTo) query = query.lte('maintenance_date', dateTo);
          const { data: records } = await query;
          data = records;
          filename = 'biaya_pemeliharaan';
          csv = [['Tanggal', 'Aset', 'Biaya Tenaga', 'Biaya Spare Part', 'Total']];
          data.forEach(r => csv.push([r.maintenance_date || '', r.assets?.asset_name || '', r.labor_cost || 0, r.spare_part_cost || 0, r.total_cost || 0]));
          break;
        }
        case 'overdue-list': {
          const { data: schedules } = await supabase.from('maintenance_schedules').select('*, assets:asset_id (asset_name, asset_code), maintenance_types:maintenance_type_id (maintenance_name)').eq('schedule_status', 'terlambat').eq('is_active', true);
          data = schedules;
          filename = 'pemeliharaan_terlambat';
          csv = [['Kode Aset', 'Nama Aset', 'Tipe', 'Jatuh Tempo', 'Status']];
          data.forEach(s => csv.push([s.assets?.asset_code || '', s.assets?.asset_name || '', s.maintenance_types?.maintenance_name || '', s.next_maintenance_date || '', s.schedule_status]));
          break;
        }
        default: {
          const { data: result } = await supabase.from('assets').select('*, categories:category_id (category_name)').eq('is_active', true).limit(100);
          data = result;
          filename = 'laporan_aset';
          csv = [['Kode', 'Nama', 'Kategori', 'Status']];
          data.forEach(a => csv.push([a.asset_code, a.asset_name, a.categories?.category_name || '', a.asset_status]));
        }
      }

      if (!data || data.length === 0) {
        toast.error('Tidak ada data untuk laporan ini');
        setLoading(false);
        return;
      }

      // Generate CSV
      const csvContent = csv.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      toast.success(`Laporan ${filename} berhasil diunduh`);
    } catch (error) {
      toast.error('Gagal membuat laporan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Laporan</h1>
        <p className="text-sm text-ink-400 mt-1">Buat dan unduh laporan aset dan pemeliharaan</p>
      </div>

      <div className="card">
        <h3 className="text-base font-semibold text-white mb-3">Filter Tanggal (untuk laporan biaya)</h3>
        <div className="flex gap-3 items-end">
          <div><label className="label">Dari</label><input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
          <div><label className="label">Sampai</label><input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map(report => (
          <div key={report.id} className="card hover-card">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary-500/10 border border-primary-500/20">
                <FileText size={20} className="text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white">{report.title}</h3>
                <p className="text-xs text-ink-400 mt-1">{report.desc}</p>
                <button
                  onClick={() => generateReport(report.id)}
                  disabled={loading}
                  className="btn-primary btn-sm mt-3"
                >
                  <Download size={14} /> {loading ? 'Memproses...' : 'Unduh CSV'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
